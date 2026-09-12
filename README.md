# Inventario Ropa

Aplicación de inventario de prendas con Next.js + Supabase.

## Funciones
- Códigos automáticos R001, R002...
- Fotos en Supabase Storage
- Precio de compra y venta
- Ganancia por prenda y total
- Disponible / vendido
- Búsqueda por código, nombre, marca, categoría o talla
- Resumen de inventario, ventas y ganancias
- Diseño responsive para computadora y celular
- Autenticación por correo y contraseña

## Configuración

1. En Supabase, abre **SQL Editor**, crea una consulta nueva y pega `supabase/schema.sql`. Ejecuta todo.
2. En Supabase > **Connect**, copia Project URL y Publishable key.
3. En local crea `.env.local` a partir de `.env.example`.
4. Ejecuta `npm install` y `npm run dev`.
5. Para Internet, importa este repositorio en Vercel y agrega las mismas variables de entorno.

No subas `.env.local` a GitHub. Las credenciales deben configurarse como variables de entorno en Vercel.
