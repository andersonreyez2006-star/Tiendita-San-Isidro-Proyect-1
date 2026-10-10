# 🚀 Guía de Despliegue y Ejecución - Tiendita San Isidro

Esta guía explica cómo ejecutar la aplicación de forma local, cómo compartirla públicamente por Internet mediante **Cloudflare Tunnel con HTTPS**, y cómo prepararla para tu hosting.

---

## Ejecución local

Necesitas Node.js y una instancia MySQL/MariaDB accesible. Importa `database/schema.sql` en una base de datos antes de iniciar la API. Para XAMPP con los valores por defecto, `.env.example` ya indica host `127.0.0.1`, puerto `3306`, usuario `root` y contraseña vacía; confirma que tu configuración de MySQL coincida antes de usar esos valores.

```powershell
# Instalar dependencias
npm install

# Copiar .env.example a .env y editar DB_HOST, DB_USER, DB_PASSWORD y DB_NAME
# Iniciar el backend en una terminal
npm run server

# En otra terminal, frontend con proxy /api hacia el backend
npm run dev

# Compilar el frontend
npm run build
```

La interfaz estará en `http://localhost:5180`. Verifica la API y la conexión SQL en `http://localhost:3001/api/health`. Para abrirla desde un teléfono en la misma Wi-Fi, usa la IP local de la PC (por ejemplo, `http://192.168.11.157:5180`) y agrega ese origen a `CORS_ORIGINS` en `.env`; reemplaza la IP de ejemplo por la dirección actual de la PC y reinicia `npm run server`. `npm run preview` sirve el frontend compilado, pero no incluye el proxy de desarrollo; configura `VITE_API_URL` para apuntar a la URL pública de la API antes de compilar.

## Despliegue

Cloudflare Pages publica únicamente el frontend estático. El backend Node.js y MySQL/MariaDB deben estar en servicios desplegados y activos por separado; Pages no ejecuta `server/index.js`.

1. Despliega el backend Node.js desde el repositorio (incluidos `package.json`, `package-lock.json` y `server/`) en un hosting que soporte Node.js, con comando de inicio `npm start`. Configura sus variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT` y `CORS_ORIGINS`.
2. Importa `database/schema.sql` en MySQL/MariaDB. Configura firewall y permisos para que solo el backend llegue a la base de datos.
3. Protege la API con autenticación o un proxy de acceso antes de exponerla públicamente. La API actual no autentica usuarios; CORS no reemplaza autenticación.
4. Configura el secreto `VITE_API_URL` en el repositorio de GitHub como la URL HTTPS de la API terminada en `/api` (por ejemplo `https://api.ejemplo.com/api`). El workflow lo usa al compilar el frontend.
5. Configura `CORS_ORIGINS` con el origen HTTPS del sitio, sin la ruta `/api`, y publica el frontend en Cloudflare Pages.

No guardes credenciales de base de datos en variables `VITE_*`, archivos del frontend o el repositorio. No uses un túnel temporal de desarrollo como alojamiento permanente.
