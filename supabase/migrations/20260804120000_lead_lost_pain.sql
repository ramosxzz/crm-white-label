-- Ao marcar um lead como perdido, alem do motivo ja existente, querem
-- registrar a "dor" do cliente (objecao/dor real por tras da desistencia),
-- separado do motivo (resumo curto).
alter table leads add column if not exists lost_pain text;
