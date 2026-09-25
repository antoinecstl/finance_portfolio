-- Autorise l'audit des imports provenant de photos et captures d'écran.
alter table public.import_jobs
  drop constraint if exists import_jobs_source_type_check;

alter table public.import_jobs
  add constraint import_jobs_source_type_check
  check (source_type in ('csv', 'xlsx', 'pdf', 'image', 'text'));
