

-- ── PROFILES ──────────────────────────────────────────────────
-- Extiende auth.users con nombre y rol (admin/cliente).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'cliente' check (role in ('admin','cliente')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Función auxiliar: security definer para poder usarla dentro de
-- políticas de otras tablas sin recursión de RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Crea automáticamente el profile al registrarse un usuario nuevo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'cliente'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── PRODUCTS ──────────────────────────────────────────────────
create table public.products (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null check (category in ('celulares','portatiles','electrodomesticos')),
  price numeric not null,
  img text,
  description text,
  specs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Products are viewable by everyone"
  on public.products for select
  using (true);

create policy "Only admins can insert products"
  on public.products for insert
  with check (public.is_admin());

create policy "Only admins can update products"
  on public.products for update
  using (public.is_admin());

create policy "Only admins can delete products"
  on public.products for delete
  using (public.is_admin());

-- Datos iniciales (los mismos que estaban mockeados en script.js)
insert into public.products (name, category, price, img, description, specs) values
('Laptop HP Pavilion','portatiles',2500,'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80','Potencia y rendimiento para trabajo y estudio. Diseño delgado con pantalla IPS Full HD.','["Intel Core i7-1255U","16GB DDR4","512GB SSD NVMe","15.6\" Full HD","Windows 11"]'),
('iPhone 15 Pro','celulares',4200,'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=800&q=80','El iPhone más avanzado. Chip A17 Pro, cámara de 48MP y titanio de grado aeroespacial.','["Chip A17 Pro","256GB almacenamiento","Titanio Natural","Cámara 48MP","USB-C"]'),
('Nevera LG InstaView','electrodomesticos',3800,'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&q=80','Tecnología Door-in-Door con panel de vidrio iluminado. Ahorro energético clase A++.','["617 litros","Door-in-Door","Clase A++","No Frost Total","Dispensador de agua"]'),
('TV Samsung QLED','electrodomesticos',2800,'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80','Pantalla QLED 4K con 120Hz y procesador Neural Quantum. Experiencia cinematográfica.','["65\" 4K QLED","120Hz","HDR10+","Neural Quantum 4K","Smart TV Tizen"]'),
('MacBook Air M3','portatiles',5500,'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&q=80','El portátil más vendido del mundo. Chip M3 con rendimiento increíble y hasta 18h de batería.','["Apple M3","16GB RAM unificada","512GB SSD","Pantalla Liquid Retina","Batería 18h"]');

-- ── ORDERS / ORDER_ITEMS ──────────────────────────────────────
create table public.orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  total numeric not null,
  status text not null default 'pendiente',
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Users can create own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id),
  product_name text not null,
  price numeric not null,
  created_at timestamptz not null default now()
);

alter table public.order_items enable row level security;

create policy "Users can view own order items"
  on public.order_items for select
  using (exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
  ));

create policy "Users can insert own order items"
  on public.order_items for insert
  with check (exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
  ));
