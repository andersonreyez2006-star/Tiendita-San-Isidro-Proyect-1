# Guía de Ejecución y Alojamiento - Tiendita San Isidro

## Ejecución local

Necesitas Node.js y una base PostgreSQL de Neon. En Neon, ejecuta `database/schema.sql` en una base nueva o, si ya existe la base, ejecuta una sola vez `database/migrations/001_password_recovery.sql`. Copia `.env.example` como `.env` y completa `DATABASE_URL` y `SESSION_SECRET`. Para enviar correos, agrega también las credenciales OAuth de Gmail API y `APP_BASE_URL`. El archivo `.env` está excluido de Git.

```powershell
# Instalar dependencias
npm install

# Iniciar API y frontend, cada uno en su terminal
npm run server
npm run dev

# Compilar el frontend
npm run build
```

La interfaz local estará en `http://localhost:5180`; no uses **Go Live** de Live Server, porque no ejecuta la API. El Vite dev server reenvía `/api` a `http://localhost:3001`. Comprueba la conexión con `http://localhost:3001/api/health`. Para ver el sitio desde otro dispositivo en la misma red, abre la IP local de la computadora y permite el puerto 5180 en el firewall; configura ese origen en `CORS_ORIGINS` si no es el mismo host.

## Vercel + Neon

1. Crea un proyecto PostgreSQL en Neon con el plan que hayas elegido y ejecuta `database/schema.sql` desde su SQL Editor. La app inicia vacía; importar datos de Railway requiere una migración aparte.
2. En Neon, copia el connection string recomendado para Node.js. No lo pegues en el chat ni en el código.
3. En Vercel importa este repositorio desde GitHub. Usa el directorio raíz predeterminado, el comando de compilación `npm run build` y el directorio de salida `dist`.
4. Habilita **Gmail API** en Google Cloud. Configura la pantalla de consentimiento OAuth y crea un cliente OAuth 2.0. Autoriza el alcance `https://www.googleapis.com/auth/gmail.send` para la cuenta remitente y obtén su refresh token mediante un flujo OAuth seguro. Una API key no autoriza a enviar correo. No pegues secretos en el chat ni los incluyas en el frontend.
5. En **Project Settings → Environment Variables**, configura `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_SENDER_EMAIL` y `APP_BASE_URL` (el origen HTTPS público de Vercel). Añádelas a los entornos necesarios y no uses el prefijo `VITE_` para secretos.
6. Despliega o redepliega el proyecto. La web y las rutas `/api/*` se sirven desde Vercel; `api/[...route].js` atiende rutas con un segmento y `vercel.json` reescribe las rutas anidadas hacia el manejador compartido `api/handler.js`. Así se usan dos funciones serverless, dentro del límite del plan Hobby. No hace falta `RAILWAY_API_URL`, un dominio de API en Railway ni `CORS_ORIGINS` para el mismo origen.
7. Prueba `/api/health`, registro y verificación del correo, recuperación de contraseña, inicio de sesión y las operaciones de categorías, productos y ventas. La venta usa una transacción PostgreSQL para que encabezado, detalles y descuento de existencias se confirmen o reviertan juntos.

Cuando una app OAuth externa permanece en modo de prueba, Google puede hacer que los refresh tokens expiren después de siete días. Para uso público continuo, completa los requisitos de publicación/verificación que Google aplique al proyecto y al alcance solicitado.

`DATABASE_URL`, `SESSION_SECRET` y las credenciales OAuth deben mantenerse privadas. No incluyas contraseñas ni tokens en el frontend ni en commits. Neon puede suspender o limitar recursos según las cuotas del plan; Vercel Hobby también tiene condiciones de uso y límites propios. Revisa los límites vigentes y no habilites facturación si quieres evitar cargos.

El código ya no depende de Railway. Este cambio no pausa, elimina ni desconecta desde el panel un proyecto Railway existente, y no transfiere automáticamente sus datos. Conserva el proyecto/volumen hasta verificar Neon y decidir explícitamente qué hacer con esos datos.

El registro de cuentas es público y cada cuenta tiene permisos completos: puede cambiar categorías, productos, existencias y ventas. No publiques datos reales hasta que aceptes ese riesgo.
