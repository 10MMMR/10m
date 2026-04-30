alter table if exists public.material_folder
  alter column "index" type double precision using "index"::double precision;
