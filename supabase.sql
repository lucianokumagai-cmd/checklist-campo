create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  etapa text not null check (etapa in ('saida','retorno')),
  responsavel text not null check (length(responsavel) between 1 and 200),
  equipe text check (length(equipe) <= 500),
  veiculo text check (length(veiculo) <= 200),
  ordem_servico text check (length(ordem_servico) <= 200),
  local text check (length(local) <= 300),
  itens_ok int not null,
  itens_total int not null,
  pendencias jsonb not null default '[]'::jsonb,
  itens jsonb not null default '[]'::jsonb,
  observacoes text check (length(observacoes) <= 5000),
  iniciado_em timestamptz,
  concluido_em timestamptz not null,
  recebido_em timestamptz not null default now()
);
create index checklists_concluido_idx on public.checklists (concluido_em desc);
alter table public.checklists enable row level security;
-- App de campo (sem login): só pode inserir
create policy "campo insere" on public.checklists for insert to anon, authenticated with check (true);
-- Escritório (usuário logado): pode ler
create policy "escritorio le" on public.checklists for select to authenticated using (true);
grant insert on public.checklists to anon;
grant select, insert on public.checklists to authenticated;

-- Leitura restrita a e-mails do escritório
create table if not exists public.escritorio_usuarios (email text primary key);
alter table public.escritorio_usuarios enable row level security;
create or replace function public.is_escritorio() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.escritorio_usuarios e where lower(e.email) = lower(auth.jwt()->>'email'));
$$;
alter policy "escritorio le" on public.checklists using ((select public.is_escritorio()));
-- Para liberar alguém do escritório:
-- insert into public.escritorio_usuarios (email) values ('pessoa@empresa.com.br');

-- Login obrigatório no app de campo: cada checklist registra quem preencheu
alter table public.checklists
  add column usuario_id uuid default auth.uid() references auth.users(id),
  add column usuario_email text default (auth.jwt()->>'email'),
  add column usuario_nome text check (length(usuario_nome) <= 200);
alter policy "campo insere" on public.checklists to authenticated with check (usuario_id = (select auth.uid()));
create or replace function public.checklists_set_usuario() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.usuario_email := auth.jwt()->>'email';
  new.recebido_em := now();
  return new;
end $$;
create trigger checklists_set_usuario before insert on public.checklists
for each row execute function public.checklists_set_usuario();
