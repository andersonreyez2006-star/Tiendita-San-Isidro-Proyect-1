# 🏪 Tiendita San Isidro - Sistema de Gestión

Sistema web moderno y organizado para el control de inventario, punto de venta (caja) y gestión de ventas de **Tiendita San Isidro**.

Desarrollado con **HTML5**, **TypeScript**, **CSS3 Modular** y preparado para despliegue con protocolo seguro **HTTPS** mediante **Cloudflare Tunnel** y base de datos relacional en hosting (**MySQL / MariaDB**).

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
│   └── GUIA_DESPLIEGUE.md    # Guía para ejecución local y túnel Cloudflare HTTPS
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
│   ├── 📁 services/          # Lógica de negocio y persistencia
│   │   ├── storage.service.ts      # Base de datos local y transacciones de venta
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
└── vite.config.ts            # Configuración de Vite con soporte para Cloudflare
```

---

## ⚡ Comandos Rápidos

```powershell
# 1. Compilar el proyecto TypeScript
npm run build

# 2. Iniciar el servidor local
npm run preview

# 3. Compartir por Internet con Cloudflare Tunnel (HTTPS)
npm run tunnel
```

---

## 🔒 Acceso Público Seguro
El túnel de Cloudflare permite acceso mundial con cifrado **HTTPS**:
👉 Consulta [`docs/GUIA_DESPLIEGUE.md`](file:///c:/Users/ander/OneDrive%20-%20Universidad%20Don%20Bosco/Escritorio/Tiendita%20San%20Isidro/docs/GUIA_DESPLIEGUE.md) para más detalles.
