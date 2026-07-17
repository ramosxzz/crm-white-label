-- Remove duplicate deliveries of the same WhatsApp message (same external_id),
-- keeping the earliest row per external_id. A WhatsApp message id (key.id) is
-- globally unique by design, so any duplicate here is a redelivery/race, not
-- a legitimate second message.
with ranked as (
  select id, external_id,
    row_number() over (partition by external_id order by created_at asc, id asc) as rn
  from messages
  where external_id is not null and external_id <> ''
)
delete from messages
where id in (select id from ranked where rn > 1);

-- Enforce global uniqueness at the DB level so a race between concurrent
-- webhook deliveries (Evolution retries up to 10x) can never insert the same
-- WhatsApp message twice, in the same tenant or a different one.
create unique index if not exists messages_external_id_unique_idx
  on messages (external_id)
  where external_id is not null and external_id <> '';
