-- ============================================================================
-- 90_apelido_e_cidades.sql  (JÁ RODADO no banco 2026-07-20)
-- 1) Apelido da pessoa (mostrado junto com nome + foto).
-- 2) Padronização de cidade/estado: o cadastro passa a usar Estado + Cidade da
--    base IBGE (src/lib/cidadesBR.ts, componente SeletorCidade) — escolher da
--    lista evita erro de digitação. Aqui unificamos o que já existia (só 12
--    grafias, todas SP) pro nome canônico.
-- ============================================================================
alter table public.people add column if not exists apelido text;

update public.people set cidade='Lençóis Paulista', estado='SP'
  where trim(cidade) in ('Lençois Paulista','Lençóis paulista','Lençóis Paulista','Lençóis pta','LP');
update public.people set cidade='Macatuba', estado='SP'
  where trim(cidade) in ('Macatuba','MACATUBA','Macatuba-Sp');
update public.people set cidade='Marília', estado='SP'
  where trim(cidade) in ('Marilia','Marília');
update public.people set cidade='Pederneiras', estado='SP'
  where trim(cidade) in ('Pederneiras','Perderneiras');
