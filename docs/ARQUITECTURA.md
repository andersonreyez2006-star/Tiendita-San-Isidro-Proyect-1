# Arquitectura del Proyecto - Tiendita San Isidro

La aplicación sigue una arquitectura cliente/API/base de datos. El navegador no se conecta directamente a MySQL: todas las consultas pasan por Express, que mantiene las credenciales fuera del código público.

## Componentes

- `src/`: frontend TypeScript. Las vistas (`src/ui/`) usan `DatabaseService` (`src/services/storage.service.ts`) para enviar solicitudes HTTP a `/api`.
- `server/index.js`: API Express para categorías, productos y ventas. Valida entradas y devuelve errores HTTP explícitos.
- `server/db.js`: pool MySQL compartido por el servidor, configurado únicamente con variables de entorno.
- `database/schema.sql`: tablas y claves foráneas que deben existir antes de iniciar la API.
- `vite.config.ts`: durante desarrollo reenvía `/api` desde Vite a `http://localhost:3001`.

## API

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/health` | Verifica API y conexión MySQL |
| GET, POST | `/api/categorias` | Consultar y crear categorías |
| DELETE | `/api/categorias/:id` | Eliminar categoría sin productos asociados |
| GET, POST | `/api/productos` | Consultar y crear productos |
| PUT, DELETE | `/api/productos/:id` | Actualizar y eliminar productos |
| GET | `/api/ventas` | Consultar historial |
| GET | `/api/ventas/:id` | Consultar ticket y sus detalles |
| POST | `/api/ventas` | Registrar venta y descontar stock |

El alta de una venta bloquea los productos seleccionados y registra encabezado, detalles y actualización de inventario en una sola transacción MySQL. Si falla alguna validación o consulta, se revierte toda la operación.

## Flujo

1. El navegador llama a la API; no guarda inventario ni ventas en `localStorage`.
2. Express valida los datos y usa consultas parametrizadas en MySQL.
3. MySQL aplica las claves foráneas y persiste los cambios para todos los dispositivos que usen la misma API.
4. Para producción, el frontend estático y la API deben tener HTTPS, el servidor requiere acceso de red a MySQL y `CORS_ORIGINS` debe contener el origen real del sitio.

La API no incorpora autenticación de usuarios. No se debe publicar abierta en Internet: protégela con autenticación/proxy de acceso (por ejemplo, Cloudflare Access) antes de habilitar operaciones de escritura.
