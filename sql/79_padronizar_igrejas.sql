-- ============================================================================
-- 79_padronizar_igrejas.sql — padroniza o campo church (igreja)
-- O campo era texto livre e virou bagunça. Agora no cadastro/pré-cadastro é uma
-- caixa de seleção única (lista fixa em src/lib/igrejas.ts). Este script migra
-- os dados ANTIGOS pros valores padrão. JÁ RODADO no banco (2026-07-13).
--
-- Lista padrão: Adoradores Mac / LP / Ped / Guedes, Ad Vec, Rompendo em Fé, Outros.
-- Decisão do Anderson: "Adoradores" genérico (sem cidade) -> Adoradores Mac.
-- Nomes de cidade (Brotas, Igaraçu, Paraná, Mineiros do Tietê...) -> Outros.
-- Vazios continuam vazios.
-- ============================================================================

update people set church = case
  when lower(church) like '%rompendo%' then 'Rompendo em Fé'
  when lower(church) like '%vec%' then 'Ad Vec'
  when lower(church) like '%guedes%' then 'Adoradores Guedes'
  when lower(church) like '%pederneira%' or lower(church) like '%perderneira%' then 'Adoradores Ped'
  when lower(church) like '%lenç%' or lower(church) like '% lp%' or lower(church) like 'lp%' then 'Adoradores LP'
  when lower(church) like '%mac%' then 'Adoradores Mac'
  when lower(church) like '%adorad%' or lower(church) like '%adored%' then 'Adoradores Mac'
  else 'Outros'
end
where nullif(trim(church),'') is not null;
