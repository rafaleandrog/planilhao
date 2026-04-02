-- Estrutura mínima para o painel habitacional
create table if not exists public.setores (
  id bigint generated always as identity primary key,
  nome text not null,
  descricao text
);

create table if not exists public.empreendimentos (
  id bigint generated always as identity primary key,
  setor_id bigint not null references public.setores(id) on delete cascade,
  nome text not null,
  status_registro text,
  vgv_total numeric(14,2) default 0
);

create table if not exists public.unidades (
  id bigint generated always as identity primary key,
  empreendimento_id bigint not null references public.empreendimentos(id) on delete cascade,
  endereco text not null,
  matricula text,
  area_m2 numeric(12,2),
  uso text,
  tipo_lote text,
  valor_unidade numeric(14,2) default 0,
  quitado boolean default false
);

create table if not exists public.proprietarios (
  id bigint generated always as identity primary key,
  nome text not null,
  cpf text,
  telefone text,
  email text
);

create table if not exists public.unidade_proprietarios (
  unidade_id bigint not null references public.unidades(id) on delete cascade,
  proprietario_id bigint not null references public.proprietarios(id) on delete cascade,
  primary key (unidade_id, proprietario_id)
);

create table if not exists public.transacoes (
  id bigint generated always as identity primary key,
  unidade_id bigint not null references public.unidades(id) on delete cascade,
  tipo text not null,
  valor numeric(14,2) not null,
  status text,
  data_evento date
);

alter table public.setores enable row level security;
alter table public.empreendimentos enable row level security;
alter table public.unidades enable row level security;
alter table public.proprietarios enable row level security;
alter table public.unidade_proprietarios enable row level security;
alter table public.transacoes enable row level security;

-- Política simplificada para ambiente inicial (substitua por políticas mais restritas em produção)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='setores' and policyname='allow_all_setores') then
    create policy allow_all_setores on public.setores for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='empreendimentos' and policyname='allow_all_empreendimentos') then
    create policy allow_all_empreendimentos on public.empreendimentos for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='unidades' and policyname='allow_all_unidades') then
    create policy allow_all_unidades on public.unidades for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='proprietarios' and policyname='allow_all_proprietarios') then
    create policy allow_all_proprietarios on public.proprietarios for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='unidade_proprietarios' and policyname='allow_all_unidade_proprietarios') then
    create policy allow_all_unidade_proprietarios on public.unidade_proprietarios for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='transacoes' and policyname='allow_all_transacoes') then
    create policy allow_all_transacoes on public.transacoes for all to anon, authenticated using (true) with check (true);
  end if;
end $$;
