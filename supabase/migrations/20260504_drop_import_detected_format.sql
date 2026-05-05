-- The import format label is an internal parsing detail and should not be
-- exposed or retained.
alter table public.import_jobs
  drop column if exists detected_format;
