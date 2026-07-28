-- Novo papel "tecnico" para o modulo de servico em campo (ERP do ACT).
-- Tecnico e o usuario que executa a ordem de servico na casa do cliente:
-- ve apenas as OS atribuidas a ele, coleta assinatura e foto, registra
-- avarias e lanca item extra (upsell) na residencia.
--
-- Precisa ficar numa migration separada: o Postgres nao permite usar um
-- valor de enum novo na mesma transacao em que ele foi criado, e as
-- policies da migration seguinte referenciam 'tecnico'.

alter type public.member_role add value if not exists 'tecnico';
