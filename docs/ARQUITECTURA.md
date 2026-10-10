# Arquitectura del Proyecto - Tiendita San Isidro

La aplicación sigue una arquitectura cliente/API/base de datos. El navegador no se conecta directamente a PostgreSQL: las funciones API de Vercel ejecutan Express y guardan `DATABASE_URL` únicamente en el servidor.

## Componentes

- `src/`: frontend TypeScript. Las vistas (`src/ui/`) usan `DatabaseService` (`src/services/storage.service.ts`) para enviar solicitudes HTTP a `/api`.
- `server/app.js`: API Express para autenticación, categorías, productos y ventas. Valida entradas y devuelve errores HTTP explícitos.
- `server/db.js`: pool PostgreSQL de Neon mediante `@neondatabase/serverless`, configurado con `DATABASE_URL`.
- `server/email.js`: envío de enlaces de verificación y recuperación mediante Gmail API con OAuth; los secretos se leen solo en el backend.
- `server/index.js`: punto de entrada para ejecutar la misma API localmente.
- `database/schema.sql`: esquema PostgreSQL para usuarios, correos verificados, tokens temporales, categorías, productos, ventas y detalles.
- `database/migrations/001_password_recovery.sql`: actualización aditiva para bases ya existentes.
- `vite.config.ts`: durante desarrollo reenvía `/api` desde Vite a `http://localhost:3001`.
- `api/`: funciones Vercel que ejecutan la API Express en el mismo origen que el frontend; no llaman a Railway.

## API

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/auth/session` | Comprueba la sesión actual |
| POST | `/api/auth/register` | Crea una cuenta individual y la autentica |
| POST | `/api/auth/login` | Inicia sesión |
| POST | `/api/auth/logout` | Cierra sesión |
| POST | `/api/auth/password/forgot` | Solicita un enlace de recuperación sin revelar si la cuenta existe |
| POST | `/api/auth/password/reset` | Consume el token de un solo uso y cambia la contraseña |
| POST | `/api/auth/email/verify` | Verifica el correo con un token temporal |
| GET | `/api/auth/account` | Consulta el correo de la cuenta |
| POST | `/api/auth/account/email` | Agrega o cambia el correo e inicia su verificación |
| POST | `/api/auth/account/email/resend` | Reenvía la verificación del correo |
| GET | `/api/health` | Verifica API y conexión con Neon |
| GET, POST | `/api/categorias` | Consultar y crear categorías |
| DELETE | `/api/categorias/:id` | Eliminar categoría sin productos asociados |
| GET, POST | `/api/productos` | Consultar y crear productos |
| PUT, DELETE | `/api/productos/:id` | Actualizar y eliminar productos |
| GET | `/api/ventas` | Consultar historial |
| GET | `/api/ventas/:id` | Consultar ticket y sus detalles |
| POST | `/api/ventas` | Registrar venta y descontar stock |

Todas las rutas de datos requieren una sesión firmada en una cookie `HttpOnly`; las claves se derivan con `scrypt` y nunca se guardan en el navegador. El registro requiere correo y usuario. Las cuentas existentes pueden agregar un correo desde **Mi correo**; solo las direcciones verificadas permiten recuperar la contraseña. Los enlaces tienen un token aleatorio de un solo uso, se almacena únicamente su hash y vencen tras una hora. Al restablecer una contraseña se invalidan las sesiones activas.

El alta de una venta bloquea los productos seleccionados y registra encabezado, detalles y actualización de inventario en una transacción PostgreSQL. Si falla alguna validación o consulta, se revierte toda la operación.

## Flujo

1. El navegador llama a la API; no guarda inventario ni ventas en `localStorage`.
2. Express valida los datos y usa consultas PostgreSQL parametrizadas.
3. Neon persiste los cambios para todos los dispositivos que usen el mismo proyecto.
4. En producción, Vercel aloja el frontend y las funciones `/api/*`; estas acceden directamente a Neon usando `DATABASE_URL`.
5. Mantén `DATABASE_URL`, `SESSION_SECRET` y las credenciales OAuth de Gmail como variables privadas del entorno del backend. No uses el prefijo `VITE_` para secretos.

El registro es abierto y cada cuenta registrada tiene permisos completos, por decisión de producto. Esto permite que cualquier persona que encuentre la URL registre una cuenta y modifique inventario, categorías y ventas. No uses datos reales de un negocio en un sitio público sin añadir controles de acceso más estrictos, verificación de usuarios y recuperación de cuentas.

La desconexión de Railway en el código no borra ni detiene un servicio Railway existente. Los datos de Railway tampoco se migran automáticamente a Neon.
