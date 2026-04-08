# Painel Habitacional (GitHub Pages + Supabase)

Este projeto foi ajustado para operar **exclusivamente com Supabase**.

- ❌ Airtable removido da arquitetura.
- ✅ Interface web no GitHub Pages lendo/escrevendo direto no Supabase.
- ✅ Atualização automática no front-end via Supabase Realtime.

---

## Arquitetura atual

`GitHub Pages (index.html + app.js) <-> Supabase (Postgres + Realtime)`

A aplicação:

1. carrega dados do Supabase;
2. permite criar/editar/excluir registros;
3. aplica alterações no banco imediatamente;
4. escuta eventos Realtime para refletir alterações automáticas na tela.

---

## 1) Preparar banco no Supabase

No SQL Editor do Supabase, execute `supabase/schema.sql`.

O schema cria as tabelas:

- `setores`
- `empreendimentos`
- `unidades`
- `proprietarios`
- `unidade_proprietarios`
- `transacoes`

Também ativa RLS e políticas iniciais para uso no painel.

> Importante: para produção, refine as políticas RLS de acordo com suas regras de acesso.

---

## 2) Configurar conexão no front-end

Edite `config.js` com os dados do seu projeto:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'SUA_ANON_KEY'
};
```

Com isso, o front-end no GitHub Pages já consegue autenticar como `anon` e operar nas tabelas.

### Diagnóstico de conexão (novo)

O app agora valida automaticamente:

1. formato da URL do Supabase (removendo espaços/aspas acidentais);
2. inicialização real do cliente Supabase no navegador;
3. compatibilidade do schema (`legacy` com views avançadas vs `minimal` com tabelas básicas).

Se a conexão estiver ativa, mas o schema não bater com o esperado, a tela mostra um erro explícito com detalhes técnicos para facilitar a correção.

### Secrets “sumindo” ao editar no GitHub

Isso é comportamento normal do GitHub: depois que você salva um secret, o valor nunca mais aparece em texto puro.

- Você verá apenas o nome do secret (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) e o horário de atualização.
- Para atualizar, clique em editar e cole novamente o valor completo.
- O workflow de deploy valida se o `dist/config.js` foi realmente gerado sem `PLACEHOLDER`.

---

## 3) Publicar no GitHub Pages

1. Faça `git push` na branch.
2. No GitHub: **Settings → Pages**.
3. Source: **Deploy from a branch**.
4. Selecione a branch `gh-pages` e pasta `/ (root)` (publicada pelo workflow), **ou** selecione `GitHub Actions`.

> Se estiver em `main /root`, o site publica `config.js` com placeholder e o painel não conecta.

Após publicado, a página já abre o painel conectado ao Supabase.

---


### Deploy com GitHub Actions (recomendado)

O workflow `.github/workflows/deploy.yml` agora:

1. valida se os secrets `SUPABASE_URL` e `SUPABASE_ANON_KEY` existem;
2. gera uma pasta `dist/` com `config.js` preenchido;
3. publica apenas o `dist/` no GitHub Pages.

Se os secrets não estiverem configurados, o deploy falha com erro explícito (evita publicar com `PLACEHOLDER`).

### Fallback rápido para diagnóstico

Se precisar testar rapidamente em produção, você pode abrir a URL com query string:

`?supabase_url=https://SEU-PROJETO.supabase.co&supabase_anon_key=SUA_CHAVE_ANON`

O app salva essas credenciais no `localStorage` do navegador para os próximos acessos.

## 4) Informações que preciso de você para fechar 100% com sua conta

Para conectar corretamente ao seu projeto Supabase, me envie:

1. **SUPABASE_URL** do seu projeto.
2. **SUPABASE_ANON_KEY** do projeto.
3. Confirmação se quer manter acesso público (`anon`) com RLS aberto inicialmente, ou se prefere que eu restrinja políticas por usuário autenticado.

Se quiser, eu também posso te entregar uma versão com login e permissões por usuário (Auth + RLS por `auth.uid()`).
