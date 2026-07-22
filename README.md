# TechSelect — Tienda de Electrónica

Catálogo de productos con carrito de compras, login con roles (admin/cliente) y panel de administración básico para editar/eliminar productos.

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
supabase/schema.sql → esquema de tablas + políticas RLS (correr una sola vez en Supabase)
```

## Modelo de datos

- **profiles** — extiende `auth.users` de Supabase con `name` y `role` (`admin` | `cliente`). Se crea automáticamente vía trigger cuando alguien se registra.
- **products** — catálogo (`name`, `category`, `price`, `img`, `description`, `specs`). Lectura pública; escritura solo para `role = 'admin'`.
- **orders** / **order_items** — pedidos generados al hacer checkout. Cada usuario solo puede ver/crear los suyos.

Detalle completo de columnas y políticas en [`supabase/schema.sql`](supabase/schema.sql).

## Puesta en marcha (equipo)

### 1. Acceso a Supabase
El proyecto vive en una **Organization** de Supabase para que todo el equipo tenga acceso (no una cuenta individual):
1. Quien administre la Organization va a **Organization Settings → Team** e invita a cada miembro por correo.
2. Cada persona acepta la invitación y ve el proyecto en su propio dashboard — nadie comparte contraseña.

### 2. Crear el esquema de base de datos
En el dashboard del proyecto: **SQL Editor → New query**, pegar el contenido de [`supabase/schema.sql`](supabase/schema.sql) y ejecutar.

### 3. Crear los usuarios de prueba
El schema no crea usuarios de Auth (Supabase no permite insertarlos por SQL directo). Crearlos manualmente:
1. **Authentication → Users → Add user**:
   - `admin@tech.com` / `admin123`
   - `cliente@tech.com` / `cliente123`
2. Subir a admin al primero corriendo en el SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'admin@tech.com');
   ```

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

- **Login/roles**: `supabase.auth.signInWithPassword` + lectura de `profiles.role` para mostrar el panel de admin.
- **Catálogo**: se carga desde `products` al iniciar y al filtrar por categoría.
- **Admin**: editar (nombre/precio) y eliminar productos — protegido por RLS, así que solo funciona si el usuario logueado tiene `role = 'admin'`.
- **Carrito y checkout**: el carrito vive en memoria del navegador; al finalizar compra se crea un registro en `orders` + `order_items` asociado al usuario autenticado.

## Pendiente / posibles siguientes pasos

- Pantalla de registro (signup) en vez de solo usuarios precargados manualmente.
- Persistir el carrito en base de datos (hoy se pierde al recargar la página).
- Pasarela de pago real — requeriría una Edge Function de Supabase para manejar la clave secreta del proveedor de pagos.
