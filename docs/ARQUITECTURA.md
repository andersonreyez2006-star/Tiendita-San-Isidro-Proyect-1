# Arquitectura del Proyecto - Tiendita San Isidro

La aplicación sigue una arquitectura cliente/API/base de datos. El navegador no se conecta directamente a MySQL: todas las consultas pasan por Express, que mantiene las credenciales fuera del código público.

## Componentes

- `src/`: frontend TypeScript. Las vistas (`src/ui/`) usan `DatabaseService` (`src/services/storage.service.ts`) para enviar solicitudes HTTP a `/api`.
- `server/index.js`: API Express para autenticación, categorías, productos y ventas. Valida entradas y devuelve errores HTTP explícitos.
- `server/db.js`: pool MySQL compartido por el servidor, configurado únicamente con variables de entorno.
- `database/schema.sql`: tablas, claves foráneas y cuentas de usuario que deben existir antes de iniciar la API.
- `vite.config.ts`: durante desarrollo reenvía `/api` desde Vite a `http://localhost:3001`.
- `api/[...path].js`: en Vercel reenvía `/api/*` a la API privada alojada en Railway, manteniendo el navegador en el mismo origen.

## API

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/auth/session` | Comprueba la sesión actual |
| POST | `/api/auth/register` | Crea una cuenta individual y la autentica |
| POST | `/api/auth/login` | Inicia sesión |
| POST | `/api/auth/logout` | Cierra sesión |
| GET | `/api/health` | Verifica API y conexión MySQL |
| GET, POST | `/api/categorias` | Consultar y crear categorías |
| DELETE | `/api/categorias/:id` | Eliminar categoría sin productos asociados |
| GET, POST | `/api/productos` | Consultar y crear productos |
| PUT, DELETE | `/api/productos/:id` | Actualizar y eliminar productos |
| GET | `/api/ventas` | Consultar historial |
| GET | `/api/ventas/:id` | Consultar ticket y sus detalles |
| POST | `/api/ventas` | Registrar venta y descontar stock |

Todas las rutas de datos requieren una sesión firmada en una cookie `HttpOnly`; las claves se derivan con `scrypt` y nunca se guardan en el navegador. El registro público crea cuentas con acceso completo a la tienda. Los intentos de registro e inicio de sesión tienen un límite por IP en el proceso API.

El alta de una venta bloquea los productos seleccionados y registra encabezado, detalles y actualización de inventario en una sola transacción MySQL. Si falla alguna validación o consulta, se revierte toda la operación.

## Flujo

1. El navegador llama a la API; no guarda inventario ni ventas en `localStorage`.
2. Express valida los datos y usa consultas parametrizadas en MySQL.
3. MySQL aplica las claves foráneas y persiste los cambios para todos los dispositivos que usen la misma API.
4. Para producción, Vercel aloja el frontend estático y reenvía `/api/*` a Railway. Railway aloja Express y MySQL en la misma red privada.
5. Configura `SESSION_SECRET`, las variables privadas `DB_*` y el dominio exacto de Vercel en `CORS_ORIGINS`; el frontend no recibe credenciales SQL.

El registro es abierto y cada cuenta registrada tiene permisos completos, por decisión de producto. Esto permite que cualquier persona que encuentre la URL registre una cuenta y modifique inventario, categorías y ventas. No uses datos reales de un negocio en un sitio público sin añadir controles de acceso más estrictos, verificación de usuarios y recuperación de cuentas.
