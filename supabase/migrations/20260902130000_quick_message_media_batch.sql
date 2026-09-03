-- Mensagem rapida "em lote": um item so que manda varias imagens de uma vez
-- (pedido: catalogo de fotos que precisa ir tudo junto, nao uma por uma).
alter table public.quick_messages
  add column if not exists media_urls text[];
