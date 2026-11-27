// Envia o relatório do checklist por e-mail ao gestor responsável pela OS (via Resend).
// Secrets: RESEND_API_KEY (obrigatório para enviar) e RESEND_FROM (ex.: "Checklist <checklist@suaempresa.com.br>").
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const NOME: Record<string, string> = { saida: "Antes de sair da sede", retorno: "Antes de voltar do campo" };
const fmt = (t: string) => new Date(t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let cid = "";
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ erro: "Sessão inválida" }, 401);
    cid = String((await req.json()).client_id || "");
    const { data: c } = await admin.from("checklists").select("*").eq("client_id", cid).maybeSingle();
    if (!c || c.usuario_id !== u.user.id) return json({ erro: "Checklist não encontrado" }, 404);
    if (c.relatorio_enviado_em) return json({ ok: true, ja_enviado: true });
    if (!c.responsavel_id) return json({ ok: true, sem_responsavel: true });
    const { data: g } = await admin.from("perfis").select("nome,email").eq("id", c.responsavel_id).maybeSingle();
    if (!g?.email) return json({ ok: true, sem_responsavel: true });

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) { await admin.from("checklists").update({ relatorio_erro: "E-mail não configurado (RESEND_API_KEY)" }).eq("id", c.id); return json({ ok: false, erro: "E-mail não configurado" }); }

    const pend: string[] = c.pendencias || [];
    const secoes = (c.itens || []).map((s: { secao: string; itens: { item: string; ok: boolean }[] }) =>
      `<h3 style="margin:16px 0 6px;color:#14812a">${esc(s.secao)}</h3><ul style="margin:0;padding-left:18px">${
        s.itens.map((i) => `<li style="${i.ok ? "" : "color:#c2410c;font-weight:600"}">${i.ok ? "✓" : "✗ Pendente:"} ${esc(i.item)}</li>`).join("")}</ul>`).join("");
    const campos = [["Responsável", g.nome], ["Equipe", c.equipe], ["Veículo", c.veiculo], ["OS / projeto", c.ordem_servico], ["Local", c.local]]
      .filter((x) => x[1]).map((x) => `<b>${x[0]}:</b> ${esc(x[1])}`).join("<br>");
    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;color:#14201a">
<h2 style="color:#14812a;margin:0 0 4px">Checklist de campo: ${esc(NOME[c.etapa] || c.etapa)}</h2>
<p style="margin:0 0 12px;color:#5b6b61">Concluído em ${fmt(c.concluido_em)}</p>
<p>${campos}</p>
<p><b>${c.itens_ok} de ${c.itens_total} itens conferidos.</b>${pend.length ? ` <span style="color:#c2410c">${pend.length} pendência(s).</span>` : ""}</p>
${c.observacoes ? `<p><b>Observações:</b> ${esc(c.observacoes)}</p>` : ""}
${secoes}
<p style="margin-top:20px;border-top:1px solid #dde5df;padding-top:10px"><b>Preenchido por:</b> ${esc(c.usuario_nome || "")} (${esc(c.usuario_email)})</p></div>`;
    const assunto = `${pend.length ? "[PENDÊNCIAS] " : ""}Checklist ${c.etapa === "saida" ? "de saída" : "de retorno"}${c.ordem_servico ? " · OS " + c.ordem_servico : ""} · ${c.usuario_nome || c.usuario_email}`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: Deno.env.get("RESEND_FROM") || "Checklist de Campo <onboarding@resend.dev>", to: [g.email], reply_to: c.usuario_email || undefined, subject: assunto, html }),
    });
    if (!r.ok) { const t = (await r.text()).slice(0, 300); await admin.from("checklists").update({ relatorio_erro: t }).eq("id", c.id); return json({ ok: false, erro: t }); }
    await admin.from("checklists").update({ relatorio_enviado_em: new Date().toISOString(), relatorio_erro: null }).eq("id", c.id);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, erro: (e as Error).message }, 500);
  }
});
