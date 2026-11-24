# Checklist de Campo

App (PWA) para as equipes de levantamento topográfico/GNSS conferirem o checklist **antes de sair da sede** e **antes de voltar do campo**.

- `index.html`: app de campo. Funciona offline; os checklists concluídos vão para o Supabase assim que houver internet.
- `painel.html`: painel do escritório (login com e-mail e senha do Supabase).
- `supabase.sql`: estrutura do banco e regras de acesso.

Para liberar alguém no painel: crie o usuário em Supabase > Authentication > Users e adicione o e-mail em `escritorio_usuarios`.
