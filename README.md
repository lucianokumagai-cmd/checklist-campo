# Checklist de Campo

App (PWA) para as equipes de levantamento topográfico/GNSS conferirem o checklist **antes de sair da sede** e **antes de voltar do campo**.

- `index.html`: app de campo. Exige login (e-mail e senha do Supabase) no primeiro acesso; depois funciona offline e os checklists concluídos vão para o Supabase assim que houver internet, com o nome de quem preencheu.
- `painel.html`: painel do escritório (login com e-mail e senha do Supabase).
- `supabase.sql`: estrutura do banco e regras de acesso.

Colaborador de campo: crie o usuário em Supabase > Authentication > Users > Add user (marque "Auto Confirm User").
Escritório (painel): crie o usuário da mesma forma e adicione o e-mail em `escritorio_usuarios`.
