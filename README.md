# Painel Habitacional (GitHub Pages + Supabase)

Interface web (HTML/CSS/JS) para navegar e editar os dados na hierarquia:

- **Setor Habitacional** → **Empreendimentos** → **Unidades** → **Transações**
- Com relacionamentos de proprietários por unidade.

## O que foi implementado

- Layout escuro com menu lateral e telas de navegação por nível.
- Rotas por hash (`#/setores`, `#/empreendimentos`, `#/empreendimento?id=...`, `#/unidade?id=...`).
- Cards e tabela no estilo das imagens de referência.
- CRUD básico para:
  - setores
  - empreendimentos
  - unidades
  - transações
- Fallback em **modo demo** se Supabase não estiver configurado.

## Estrutura

- `index.html`: página única para GitHub Pages.
- `styles.css`: estilos da interface.
- `app.js`: roteamento, renderização e integração Supabase.
- `config.js`: credenciais (você deve preencher).
- `supabase/schema.sql`: SQL base para criar tabelas e políticas.

## Como conectar no Supabase

1. No Supabase, abra SQL Editor e rode o arquivo `supabase/schema.sql`.
2. No Supabase, copie:
   - Project URL
   - anon public key
3. Preencha `config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'SUA_ANON_KEY'
};
```

4. Faça commit/push para o repositório.

## Publicar no GitHub Pages

1. No GitHub do repositório: **Settings → Pages**.
2. Em "Build and deployment":
   - Source: **Deploy from a branch**
   - Branch: `main` (ou a branch desejada), pasta `/root`
3. Salve e aguarde o link público do Pages.

## Próximos passos recomendados

- Adicionar autenticação (Supabase Auth).
- Trocar políticas "allow all" por políticas com segurança real.
- Adicionar upload de imagens por empreendimento/unidade (Supabase Storage).
- Adicionar tela de edição de proprietários e vínculo com unidade.
