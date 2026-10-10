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

La configuración prevista usa Vercel para el frontend y proxy `/api`, y Railway para Express + MySQL en una red privada:

1. En Railway crea un proyecto en el plan **Free**, agrega un servicio MySQL y confirma que tenga un volumen persistente montado en `/var/lib/mysql`. No habilites upgrades ni planes de pago.
2. Agrega al mismo proyecto un servicio de API desde este repositorio. Usa `npm ci` como comando de instalación y `npm start` como inicio. Crea un dominio público solo para la API; la base debe seguir privada.
3. En el servicio API define `NODE_ENV=production`, `SESSION_SECRET` (una cadena aleatoria de al menos 32 caracteres), `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y `CORS_ORIGINS`. Referencia las variables del servicio MySQL, por ejemplo `DB_HOST=${{MySQL.MYSQLHOST}}`, `DB_PORT=${{MySQL.MYSQLPORT}}`, `DB_USER=${{MySQL.MYSQLUSER}}`, `DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}` y `DB_NAME=${{MySQL.MYSQLDATABASE}}`. Reemplaza `MySQL` por el nombre exacto del servicio.
4. Inicializa la base importando `database/schema.sql` en la instancia Railway. Esto crea también la tabla `usuarios`; no copies el archivo `.env` local ni expongas las variables SQL al frontend.
5. En Vercel importa este repositorio desde GitHub, selecciona `main` como rama de producción, el comando `npm run build` y el directorio `dist`. Configura `VITE_API_URL=/api` y `RAILWAY_API_URL=https://<dominio-publico-de-la-api>` (sin `/api` al final). El archivo `api/[...path].js` reenvía las solicitudes a Railway sin exponer la URL del backend al navegador.
6. Después del primer despliegue, vuelve a Railway y configura `CORS_ORIGINS` con el origen HTTPS exacto de Vercel, por ejemplo `https://tiendita-ejemplo.vercel.app`. Redepliega la API y verifica `/api/health`, registro, inicio de sesión y operaciones de datos.
7. Para enlazar GitHub, autoriza la aplicación oficial de Vercel en tu cuenta y selecciona este repositorio. Los siguientes cambios en `main` se desplegarán automáticamente. No compartas contraseñas ni tokens en el chat.

**Límites y costos:** Railway Free ofrece actualmente $1 USD de crédito de uso mensual y hasta 500 MB de volumen; al agotar los límites las aplicaciones pueden detenerse. No garantiza servicio siempre activo. Vercel Hobby es gratuito solo para uso personal/no comercial y pausa ciertas funciones al superar sus cuotas. No autorices un upgrade, una prueba que pida pago ni agregues método de pago si tu condición es no incurrir en cargos. Si esta tienda se usará comercialmente o necesita estar disponible 24/7, estos planes gratuitos no son una opción fiable/permitida; habrá que elegir un proveedor y plan compatible antes de publicarla.

El registro de cuentas es público y cada cuenta tiene permisos completos: puede cambiar categorías, productos, existencias y ventas. No publiques datos reales hasta que aceptes ese riesgo. Los registros locales de XAMPP no se migran con el despliegue; haz una exportación/importación separada solo después de decidir qué datos quieres subir.

Nunca guardes credenciales SQL en variables `VITE_*`, el frontend o el repositorio. Para desarrollo local sigue usando XAMPP y la configuración de la primera sección.
