-- INVENTARIO DE ROPA
-- Ejecuta TODO este archivo en Supabase > SQL Editor > New query.

create sequence if not exists public.ropa_code_seq;

create table if not exists public.prendas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('R' || lpad(nextval('public.ropa_code_seq')::text, 3, '0')),
  nombre text not null,
  marca text,
  categoria text,
  talla text,
  precio_compra numeric(12,2) not null default 0 check (precio_compra >= 0),
  precio_venta numeric(12,2) not null default 0 check (precio_venta >= 0),
  estado text not null default 'disponible' check (estado in ('disponible','vendido')),
  foto_url text,
  created_at timestamptz not null default now(),
  sold_at timestamptz
);

alter table public.prendas enable row level security;

-- Cada usuario autenticado puede gestionar el inventario.
drop policy if exists "authenticated can read prendas" on public.prendas;
create policy "authenticated can read prendas"
on public.prendas for select to authenticated using (true);

drop policy if exists "authenticated can insert prendas" on public.prendas;
create policy "authenticated can insert prendas"
on public.prendas for insert to authenticated with check (true);

drop policy if exists "authenticated can update prendas" on public.prendas;
create policy "authenticated can update prendas"
on public.prendas for update to authenticated using (true) with check (true);

drop policy if exists "authenticated can delete prendas" on public.prendas;
create policy "authenticated can delete prendas"
on public.prendas for delete to authenticated using (true);

-- Bucket de fotografías.
insert into storage.buckets (id, name, public)
values ('ropa-fotos', 'ropa-fotos', true)
on conflict (id) do nothing;

drop policy if exists "authenticated can upload ropa photos" on storage.objects;
create policy "authenticated can upload ropa photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'ropa-fotos');

drop policy if exists "authenticated can update ropa photos" on storage.objects;
create policy "authenticated can update ropa photos"
on storage.objects for update to authenticated
using (bucket_id = 'ropa-fotos')
with check (bucket_id = 'ropa-fotos');

drop policy if exists "authenticated can delete ropa photos" on storage.objects;
create policy "authenticated can delete ropa photos"
on storage.objects for delete to authenticated
using (bucket_id = 'ropa-fotos');

-- Las fotos se sirven públicamente porque el bucket es público.
drop policy if exists "public can read ropa photos" on storage.objects;
create policy "public can read ropa photos"
on storage.objects for select to public
using (bucket_id = 'ropa-fotos');

-- Índices para búsqueda y dashboard.
create index if not exists prendas_code_idx on public.prendas(code);
create index if not exists prendas_estado_idx on public.prendas(estado);
create index if not exists prendas_created_idx on public.prendas(created_at desc);
