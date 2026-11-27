// Cadastro de usuários: só administradores. Usa a chave de serviço no servidor.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const SENHA_INICIAL = "123456";
const PAPEIS = ["admin", "gestor", "usuario"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u, error: ue } = await admin.auth.getUser(jwt);
    if (ue || !u?.user) return json({ erro: "Sessão inválida" }, 401);
    const { data: eu } = await admin.from("perfis").select("papel, ativo").eq("id", u.user.id).maybeSingle();
    if (!eu || eu.papel !== "admin" || !eu.ativo) return json({ erro: "Apenas administradores" }, 403);

    const b = await req.json();
    const acao = b.acao;

    if (acao === "listar") {
      const { data, error } = await admin.from("perfis").select("id,nome,celular,email,papel,ativo,trocar_senha,criado_em").order("nome");
      if (error) throw error;
      return json({ usuarios: data });
    }

    if (acao === "criar") {
      const nome = String(b.nome || "").trim(), email = String(b.email || "").trim().toLowerCase();
      const celular = String(b.celular || "").trim(), papel = String(b.papel || "usuario");
      if (!nome || !email || !PAPEIS.includes(papel)) return json({ erro: "Preencha nome, e-mail e qualificação" }, 400);
      const { data: c, error: ce } = await admin.auth.admin.createUser({
        email, password: SENHA_INICIAL, email_confirm: true, user_metadata: { nome },
      });
      if (ce) return json({ erro: ce.message.includes("already") ? "Já existe um usuário com esse e-mail" : ce.message }, 400);
      const { error: pe } = await admin.from("perfis").insert({
        id: c.user.id, nome, email, celular: celular || null, papel, trocar_senha: true, criado_por: u.user.id,
      });
      if (pe) { await admin.auth.admin.deleteUser(c.user.id); throw pe; }
      return json({ ok: true, id: c.user.id });
    }

    if (acao === "atualizar") {
      const id = String(b.id || "");
      const mud: Record<string, unknown> = {};
      if (b.nome !== undefined) mud.nome = String(b.nome).trim();
      if (b.celular !== undefined) mud.celular = String(b.celular).trim() || null;
      if (b.papel !== undefined) { if (!PAPEIS.includes(b.papel)) return json({ erro: "Qualificação inválida" }, 400); mud.papel = b.papel; }
      if (b.ativo !== undefined) mud.ativo = !!b.ativo;
      if (id === u.user.id && (mud.papel && mud.papel !== "admin" || mud.ativo === false))
        return json({ erro: "Você não pode tirar o seu próprio acesso de administrador" }, 400);
      const { error } = await admin.from("perfis").update(mud).eq("id", id);
      if (error) throw error;
      if (mud.ativo !== undefined) await admin.auth.admin.updateUserById(id, { ban_duration: mud.ativo ? "none" : "876000h" });
      if (mud.nome) await admin.auth.admin.updateUserById(id, { user_metadata: { nome: mud.nome } });
      return json({ ok: true });
    }

    if (acao === "resetar_senha") {
      const id = String(b.id || "");
      const { error } = await admin.auth.admin.updateUserById(id, { password: SENHA_INICIAL });
      if (error) throw error;
      await admin.from("perfis").update({ trocar_senha: true }).eq("id", id);
      return json({ ok: true });
    }

    return json({ erro: "Ação desconhecida" }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message || "Erro interno" }, 500);
  }
});
