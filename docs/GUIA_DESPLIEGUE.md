# Guía de Ejecución y Alojamiento - Tiendita San Isidro

---

## Ejecución local

Necesitas Node.js y una instancia MySQL/MariaDB accesible. Importa `database/schema.sql` en una base de datos antes de iniciar la API. Para XAMPP con los valores por defecto, `.env.example` ya indica host `127.0.0.1`, puerto `3306`, usuario `root` y contraseña vacía; confirma que tu configuración de MySQL coincida antes de usar esos valores.

```powershell
# Instalar dependencias
npm install

# Copiar .env.example a .env y editar DB_HOST, DB_USER, DB_PASSWORD y DB_NAME
# Iniciar el backend en una terminal
npm run server

# En otra terminal, frontend con proxy /api hacia el backend y acceso en la Wi-Fi local
npm run dev

# Compilar el frontend
npm run build
```

La interfaz estará en `http://localhost:5180`; no uses **Go Live** de Live Server, porque no compila TypeScript ni reenvía `/api`. Para abrirla desde un teléfono en la misma Wi-Fi, usa la IP local de la PC (por ejemplo, `http://192.168.11.157:5180`). Si la IP cambia, actualiza esa IP en `CORS_ORIGINS` del `.env` y reinicia `npm run server`. Verifica la conexión SQL en `http://localhost:3001/api/health`. `npm run preview` sirve el frontend compilado, pero no incluye el proxy de desarrollo; configura `VITE_API_URL` para apuntar a la URL HTTPS de la API antes de compilar.

## Alojamiento

El frontend y el backend requieren un hosting que pueda ejecutar la API Node.js y servir los archivos compilados; MySQL/MariaDB puede estar en ese proveedor o en un servicio de base de datos remoto accesible desde el backend.

1. Despliega el repositorio en un hosting compatible con Node.js, con comando de inicio `npm start`. Configura `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT` y `CORS_ORIGINS` como variables privadas del servicio.
2. Importa `database/schema.sql` en MySQL/MariaDB y configura firewall y permisos para que solo el backend pueda acceder a la base.
3. Configura `VITE_API_URL` durante la compilación del frontend con la URL HTTPS de la API terminada en `/api` (por ejemplo `https://api.ejemplo.com/api`).
4. Sirve el contenido de `dist/` y configura `CORS_ORIGINS` en el backend con el origen HTTPS del frontend.
5. Protege la API con autenticación antes de hacerla accesible públicamente; la API actual no autentica usuarios y CORS no sustituye autenticación.

No guardes credenciales de base de datos en variables `VITE_*`, archivos del frontend o el repositorio. Para desarrollo en red local, conecta los dispositivos a la misma Wi-Fi y permite en el firewall únicamente los puertos necesarios.
