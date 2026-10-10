# 🏪 Tiendita San Isidro - Sistema de Gestión

Sistema web para el control de inventario, punto de venta (caja) y gestión de ventas de **Tiendita San Isidro**, con frontend TypeScript, API Node.js/Express y base de datos MySQL/MariaDB.

El frontend estático y la API se despliegan por separado. Consulta la arquitectura y la guía de despliegue antes de publicar el backend.

---

## 🗂️ Estructura Organizada del Proyecto

El proyecto está estructurado de manera modular para garantizar legibilidad, escalabilidad y mantenimiento limpio:

```text
Tiendita San Isidro/
├── 📁 database/              # Esquema DDL y documentación de la base de datos
│   ├── README.md             # Guía de importación para hosting (cPanel / phpMyAdmin)
│   └── schema.sql            # Tablas: Categorias, Productos, Ventas, Detalle_Venta
│
├── 📁 docs/                  # Documentación técnica
│   ├── ARQUITECTURA.md       # Explicación de la arquitectura modular y flujo de datos
│   └── GUIA_DESPLIEGUE.md    # Guía de ejecución local y alojamiento
│
├── 📁 src/                   # Código fuente de la aplicación
│   ├── 📁 styles/            # Hojas de estilo CSS organizadas por propósito
│   │   ├── variables.css     # Variables de color, fuentes, bordes y sombras
│   │   ├── layout.css        # Disposición, navbar, modales y cuadrículas
│   │   ├── components.css    # Botones, tablas, tarjetas, badges y tickets
│   │   └── main.css          # Archivo maestro de estilos
│   │
│   ├── 📁 types/             # Modelos e interfaces en TypeScript
│   │   ├── categoria.model.ts# Entidad Categoria
│   │   ├── producto.model.ts # Entidad Producto
│   │   ├── venta.model.ts    # Entidades Venta y DetalleVenta
│   │   ├── cart.model.ts     # Modelo del carrito de compras
│   │   └── index.ts          # Barril unificado de tipos
│   │
│   ├── 📁 services/          # Lógica de negocio y acceso a la API
│   │   ├── storage.service.ts      # Cliente HTTP de la API
│   │   └── notification.service.ts # Mensajes emergentes (Toast)
│   │
│   ├── 📁 ui/                # Vistas y controladores de interfaz de usuario
│   │   ├── modals.ts         # Apertura y cierre de ventanas modales
│   │   ├── pos.view.ts       # Punto de Venta (Caja) y cálculo de tickets
│   │   ├── products.view.ts  # Catálogo y administración de productos
│   │   ├── categories.view.ts# Administración de categorías
│   │   └── sales.view.ts     # Historial de ventas y detalle por ticket
│   │
│   └── main.ts               # Punto de entrada y orquestación
│
├── index.html                # Plantilla HTML semántica
├── package.json              # Scripts de compilación y servidor
├── tsconfig.json             # Configuración de TypeScript
├── server/                   # API Express y conexión MySQL
├── database/                 # Esquema MySQL/MariaDB
└── vite.config.ts            # Configuración de Vite y proxy local de API
```

---

## ⚡ Comandos Rápidos

```powershell
# Instalar dependencias
npm install

# Configurar .env a partir de .env.example; en local se genera una clave de sesión temporal
# Importar database/schema.sql y arrancar backend
npm run server

# En otra terminal: arrancar frontend local
npm run dev

# Compilar frontend para producción
npm run build
```

La API requiere sesión para todas las operaciones de tienda. Se permiten registros públicos y cada cuenta nueva puede administrar categorías, productos e historial de ventas; comparte el enlace solo si aceptas ese nivel de acceso. Revisa [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y [`docs/GUIA_DESPLIEGUE.md`](docs/GUIA_DESPLIEGUE.md) para preparar MySQL y el despliegue en Vercel/Railway.
