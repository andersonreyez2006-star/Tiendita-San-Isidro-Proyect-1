# 🚀 Guía de Despliegue y Ejecución - Tiendita San Isidro

Esta guía explica cómo ejecutar la aplicación de forma local, cómo compartirla públicamente por Internet mediante **Cloudflare Tunnel con HTTPS**, y cómo prepararla para tu hosting.

---

## 💻 1. Ejecución Local

Para iniciar el servidor en tu computadora:

```powershell
# 1. Instalar dependencias (solo si es la primera vez o en una máquina nueva)
npm run install

# 2. Compilar el proyecto para verificar que no haya errores
npm run build

# 3. Iniciar el servidor local
npm run preview
```

El sistema estará accesible localmente en:
`http://localhost:5180`

---

## 🔒 2. Compartir por Internet con Cloudflare Tunnel (HTTPS)

Para que cualquier persona pueda ingresar desde cualquier lugar del mundo con conexión cifrada **HTTPS**:

1. Deja corriendo el servidor local (`npm run preview`).
2. Abre otra pestaña o ventana de PowerShell en la misma carpeta del proyecto.
3. Ejecuta el túnel de Cloudflare:
   ```powershell
   npm run tunnel
   ```
4. Cloudflare generará un enlace seguro como:
   `https://[nombre-aleatorio].trycloudflare.com`
5. Comparte ese enlace con cualquier persona para que use el sistema.

---

## 🗄️ 3. Conexión con Hosting y Base de Datos

Cuando vayas a subir el proyecto a tu proveedor de hosting:

1. Importa el archivo [`database/schema.sql`](file:///c:/Users/ander/OneDrive%20-%20Universidad%20Don%20Bosco/Escritorio/Tiendita%20San%20Isidro/database/schema.sql) en el phpMyAdmin o consola MySQL de tu hosting.
2. Sube los archivos generados dentro de la carpeta `dist/` a la carpeta `public_html` de tu hosting web.
