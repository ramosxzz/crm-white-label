-- Buckets sem limite de tamanho/tipo aceitavam qualquer arquivo (incluindo
-- executavel) de qualquer tamanho - so a franquia de storage do Supabase
-- travava. Restringe pelo uso real de cada bucket.
update storage.buckets set file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif']
  where id = 'avatars';

update storage.buckets set file_size_limit = 2097152,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml']
  where id = 'tenant-logos';

update storage.buckets set
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/quicktime','audio/mpeg','audio/ogg','audio/webm','application/pdf']
  where id = 'chat-media';

update storage.buckets set file_size_limit = 20971520,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','text/plain']
  where id = 'lead-files';

update storage.buckets set file_size_limit = 20971520,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','application/pdf']
  where id = 'service-orders';
