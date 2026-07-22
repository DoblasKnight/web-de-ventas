
alter table public.products drop constraint if exists products_category_check;

-- ── Bucket de imágenes de productos ───────────────────────────
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Cualquiera puede ver las imágenes (necesario para que el catálogo cargue)
create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Solo admins pueden subir/actualizar/borrar imágenes de productos
create policy "Admins can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admins can update product images"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());

create policy "Admins can delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());
