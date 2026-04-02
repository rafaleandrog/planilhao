# Painel Habitacional (GitHub Pages + Supabase + Sync Airtable)

Este projeto agora está preparado para:

1. **Sincronizar Airtable -> Supabase** automaticamente.
2. Usar o **Supabase como backend** da interface publicada no GitHub Pages.

---

## Arquitetura

- **Airtable**: fonte de dados operacional.
- **Script Node (`scripts/sync-airtable-to-supabase.mjs`)**: importa e faz upsert no Supabase.
- **Supabase**: banco relacional usado pelo front-end.
- **GitHub Pages (`index.html`)**: interface para navegar/editar dados.

Fluxo:

`Airtable -> (sync script / GitHub Action) -> Supabase -> (supabase-js anon) -> Front-end`

---

## 1) Preparar banco no Supabase

No SQL Editor do Supabase, execute `supabase/schema.sql`.

Esse schema já inclui:

- tabelas da hierarquia (`setores`, `empreendimentos`, `unidades`, `transacoes`),
- relacionamento com `proprietarios` via `unidade_proprietarios`,
- coluna `airtable_id` para upsert estável,
- RLS + políticas iniciais para bootstrap.

---

## 2) Configurar sync Airtable -> Supabase

### 2.1 Variáveis

Copie `.env.example` para `.env` e preencha:

- `AIRTABLE_TOKEN`
- `AIRTABLE_BASE_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AIRTABLE_MAPPING_PATH` (normalmente `airtable/mapping.json`)

### 2.2 Mapeamento

Copie `airtable/mapping.example.json` para `airtable/mapping.json` e ajuste:

- nome das tabelas no Airtable (`name`),
- nome das colunas em cada tabela (`fields`),
- nome dos campos de link entre tabelas (`relations`).

### 2.3 Rodar sincronização manual

```bash
npm install
npm run sync:airtable
```

---

## 3) Automatizar sincronização

Existe workflow em `.github/workflows/sync-airtable.yml` com:

- `workflow_dispatch` (manual),
- agendamento a cada 6h.

Configure os **GitHub Secrets**:

- `AIRTABLE_TOKEN`
- `AIRTABLE_BASE_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AIRTABLE_MAPPING_JSON` (conteúdo completo do `mapping.json` em string JSON)

---

## 4) Front-end usando Supabase

No arquivo `config.js`, preencha:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'SUA_ANON_KEY'
};
```

Com isso, o front passa a ler e editar diretamente no Supabase.

---

## 5) Deploy no GitHub Pages

1. `git push`
2. No GitHub: **Settings -> Pages**
3. Source: **Deploy from a branch**
4. Escolher branch e pasta `/root`

---

## Informações que faltam (me envie para eu ajustar 100%)

Para eu finalizar tudo exatamente com seus nomes reais do Airtable, preciso que você me passe:

1. **Nome exato** das tabelas no Airtable (ex.: "Setores Habitacionais", "Empreendimentos" etc.).
2. **Nome exato** das colunas de cada tabela.
3. Quais colunas são **links** entre tabelas (ex.: campo que liga unidade ao empreendimento).
4. Se existe algum campo de status com valores fixos (ex.: "Registrado", "Em análise").
5. Se você quer sync **somente Airtable -> Supabase** ou também retorno (bidirecional).

Se você me mandar um print de cada tabela com os nomes das colunas, eu te devolvo o `mapping.json` pronto.

---

## 6) Codex + Supabase (MCP) para revisão/atualização por comando

Este repositório agora inclui um orquestrador para você disparar tarefas no Codex por comando e já orientar o uso do Supabase via MCP.

### 6.1 Configurar MCP do Supabase no Codex

1. Copie `.codex/config.toml.example` para `~/.codex/config.toml` (ou mescle com sua config atual).
2. Rode login do provedor:

```bash
codex mcp login supabase
```

### 6.2 Disparar tarefa para o Codex executar sozinho

```bash
npm run codex:task -- --goal "Revise o app.js, proponha melhorias e aplique as correções"
```

Esse comando usa `scripts/codex-supabase-orchestrator.mjs`, que:

- monta um prompt padronizado para revisão + atualização;
- força comportamento seguro (mudanças pequenas e checks);
- tenta invocar o Codex CLI automaticamente.

### 6.3 Validar prompt sem executar

```bash
npm run codex:task -- --goal "Criar migration para novo campo" --dry-run
```

### Observação importante

Mesmo com MCP, o Codex não faz alteração “sozinho em background” sem gatilho.
Você dispara via comando (como acima) ou automatiza esse comando num scheduler/CI.
