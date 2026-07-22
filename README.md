# TechSelect — Tienda de Electrónica

Catálogo de productos con carrito de compras, login con roles (admin/cliente) y panel de administración básico para editar/eliminar productos.

## Repositorio

```
git clone https://github.com/DoblasKnight/web-de-ventas.git
```

## Arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS + JavaScript plano (sin frameworks ni build step) |
| Backend / API | Supabase (API REST autogenerada + Auth), consumida directamente desde `script.js` con el SDK `@supabase/supabase-js` |
| Base de datos | PostgreSQL administrado por Supabase |

No hay servidor propio: el frontend habla directamente con Supabase. La seguridad de los datos (quién puede leer/escribir qué) se controla con **políticas de Row Level Security (RLS)** en la base de datos, no con lógica en el navegador.

```
index.html  → estructura de la página
styles.css  → estilos
script.js   → lógica: conexión a Supabase, auth, productos, carrito, checkout
supabase/schema.sql               → esquema de tablas + políticas RLS (correr una sola vez en Supabase)
supabase/storage-and-categories.sql → bucket de imágenes + categorías libres (correr después de schema.sql)
```

## Modelo de datos

- **profiles** — extiende `auth.users` de Supabase con `name` y `role` (`admin` | `cliente`). Se crea automáticamente vía trigger cuando alguien se registra.
- **products** — catálogo (`name`, `category`, `price`, `img`, `description`, `specs`). Lectura pública; escritura solo para `role = 'admin'`. La categoría es texto libre (sin lista fija) — los filtros del catálogo se generan dinámicamente según las categorías que existan.
- **orders** / **order_items** — pedidos generados al hacer checkout. Cada usuario solo puede ver/crear los suyos.
- **Storage `product-images`** — bucket público donde se suben las imágenes de productos desde el modal de admin. Lectura pública; solo admins pueden subir/editar/borrar imágenes.

Detalle completo de columnas y políticas en [`supabase/schema.sql`](supabase/schema.sql) y [`supabase/storage-and-categories.sql`](supabase/storage-and-categories.sql).

## Puesta en marcha (equipo)

### 1. Acceso a Supabase
El proyecto vive en una **Organization** de Supabase para que todo el equipo tenga acceso (no una cuenta individual):
1. Quien administre la Organization va a **Organization Settings → Team** e invita a cada miembro por correo.
2. Cada persona acepta la invitación y ve el proyecto en su propio dashboard — nadie comparte contraseña.

### 2. Crear el esquema de base de datos
En el dashboard del proyecto: **SQL Editor → New query**, pegar el contenido de [`supabase/schema.sql`](supabase/schema.sql) y ejecutar. Después, en una query nueva, pegar y ejecutar [`supabase/storage-and-categories.sql`](supabase/storage-and-categories.sql) — crea el bucket `product-images` para las fotos de producto y quita la restricción de categorías fijas.

### 3. Crear un usuario administrador
Cualquiera puede registrarse desde el botón **Crear cuenta** en la app — el trigger `handle_new_user` le crea su `profile` automáticamente con `role = 'cliente'`. Para volver admin a un usuario ya registrado, corre en el SQL Editor:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'CORREO_DEL_USUARIO');
```

**Confirmación por correo: desactivada por ahora.** En **Authentication → Providers → Email → Confirm email** está apagado a propósito, porque el servicio de correo por defecto de Supabase es muy limitado (pocos envíos por hora) y no vale la pena configurar SMTP propio todavía. Por eso al registrarse el usuario queda logueado de inmediato, sin pasar por correo.

Si más adelante se activa (por ejemplo, para producción real con usuarios externos), habría que configurar un SMTP propio (ej. Resend) en **Project Settings → Authentication → SMTP Settings** para que los correos lleguen de forma confiable. El código ya está listo para ese caso: si `signUp` no devuelve sesión, la app muestra un modal pidiendo confirmar el correo, y la plantilla en [`supabase/email-templates/confirm-signup.html`](supabase/email-templates/confirm-signup.html) queda lista para pegar en **Authentication → Email Templates → Confirm signup**.

### 4. Conectar el frontend
En `script.js`, las constantes `SUPABASE_URL` y `SUPABASE_KEY` ya apuntan al proyecto compartido:
```js
const SUPABASE_URL = "https://tarjzxcexcgtsinwmqkk.supabase.co";
const SUPABASE_KEY = "sb_publishable_..."; // clave pública, segura de exponer
```
La clave usada es la **publishable/anon** — está pensada para ser pública y vivir en el frontend. La **secret key** de Supabase (equivalente al antiguo `service_role`) **nunca debe** ir en este proyecto: al no tener servidor, cualquier código en `script.js` es visible para quien visite el sitio, y esa clave saltaría todas las políticas RLS.

### 5. Correr el proyecto
Al ser HTML/CSS/JS plano, no necesita instalación: abrir `index.html` en el navegador (o servirlo con cualquier servidor estático, ej. `npx serve`).

## Flujos implementados

- **Login/registro/roles**: `supabase.auth.signInWithPassword` y `supabase.auth.signUp` (el modal alterna entre ambos modos) + lectura de `profiles.role` para mostrar el panel de admin.
- **Catálogo**: se carga desde `products` al iniciar y al filtrar por categoría.
- **Admin**: crear, editar y eliminar productos desde un modal completo (nombre, categoría libre, precio, imagen, descripción, specs). La imagen se sube directamente al bucket `product-images` de Supabase Storage. Todo protegido por RLS, así que solo funciona si el usuario logueado tiene `role = 'admin'`.
- **Carrito y checkout**: el carrito vive en memoria del navegador; al finalizar compra se crea un registro en `orders` + `order_items` asociado al usuario autenticado.

## Pendiente / posibles siguientes pasos

- Persistir el carrito en base de datos (hoy se pierde al recargar la página).
- Pasarela de pago real — requeriría una Edge Function de Supabase para manejar la clave secreta del proveedor de pagos.
