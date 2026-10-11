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
- `api/[...route].js`: función de Vercel para rutas API con un segmento, como `/api/health` y `/api/productos`.
- `api/handler.js` y `vercel.json`: las rutas API anidadas se reescriben a un manejador compartido, que restaura la ruta original antes de pasar la solicitud a `server/app.js`. Son dos funciones serverless en total, dentro del límite del plan Hobby; no se llama a Railway.

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

## Configuración de producción

Configura estas variables en el entorno del servidor de Vercel (por ejemplo, Production). Ninguna credencial secreta debe incluirse en el frontend, en archivos versionados ni en el chat.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL de Neon, utilizada por el pool del servidor. |
| `SESSION_SECRET` | Secreto aleatorio usado para firmar las sesiones. Debe ser privado y estable entre despliegues. |
| `APP_BASE_URL` | URL HTTPS pública de la aplicación; se usa como origen de los enlaces de verificación y restablecimiento. |
| `GOOGLE_CLIENT_ID` | ID del cliente OAuth de Google autorizado para Gmail API. |
| `GOOGLE_CLIENT_SECRET` | Secreto del mismo cliente OAuth; solo se consume en el servidor. |
| `GOOGLE_REFRESH_TOKEN` | Token de actualización OAuth con permiso `https://www.googleapis.com/auth/gmail.send`; el servidor lo intercambia por access tokens temporales. |
| `GOOGLE_SENDER_EMAIL` | Dirección Gmail autorizada que aparece como remitente; debe corresponder a la cuenta que concedió el permiso OAuth. |

Para enviar correo, `server/email.js` solicita un access token a Google usando el client ID, client secret y refresh token, y luego envía el mensaje con Gmail API. El access token es temporal y se renueva en el servidor; no se configura manualmente. El refresh token debe obtenerse con el cliente OAuth propio de la aplicación (no con las credenciales predeterminadas de OAuth 2.0 Playground, cuyos tokens pueden caducar a las 24 horas). Si el consentimiento OAuth permanece en modo de prueba, Google puede caducar el refresh token después de siete días. Revocar el permiso, cambiar las credenciales del cliente o dejar el token inactivo también puede interrumpir el envío.

Al cambiar variables de entorno en Vercel se requiere un nuevo despliegue para que las funciones las reciban. El proyecto de Vercel debe estar conectado al repositorio y a la rama de producción prevista; sin un despliegue de producción no existe una versión pública que pueda utilizar el navegador. Una vez desplegado, verifica `/api/health` y prueba el envío de verificación y recuperación con una cuenta controlada.

El registro es abierto y cada cuenta registrada tiene permisos completos, por decisión de producto. Esto permite que cualquier persona que encuentre la URL registre una cuenta y modifique inventario, categorías y ventas. No uses datos reales de un negocio en un sitio público sin añadir controles de acceso más estrictos, verificación de usuarios y recuperación de cuentas.

La desconexión de Railway en el código no borra ni detiene un servicio Railway existente. Los datos de Railway tampoco se migran automáticamente a Neon.
