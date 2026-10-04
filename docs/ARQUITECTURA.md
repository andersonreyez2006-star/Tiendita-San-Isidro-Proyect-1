# 🏛️ Arquitectura del Proyecto - Tiendita San Isidro

Este documento describe la estructura modular, separación de responsabilidades y flujo de datos de la aplicación **Tiendita San Isidro**.

---

## 📂 Organización de Directorios

```text
Tiendita San Isidro/
├── database/                # Scripts y documentación de la base de datos relacional
│   ├── README.md            # Guía para importar en hosting (cPanel/phpMyAdmin)
│   └── schema.sql           # DDL relacional (Categorías, Productos, Ventas, Detalle_Venta)
│
├── docs/                    # Documentación técnica del proyecto
│   ├── ARQUITECTURA.md      # Este documento (diseño modular y componentes)
│   └── GUIA_DESPLIEGUE.md   # Guía de despliegue con Cloudflare Tunnel y hosting
│
├── src/                     # Código fuente de la aplicación (TypeScript / CSS)
│   ├── styles/              # Módulos de estilos CSS organizados
│   │   ├── variables.css    # Paleta de colores, sombras y radios
│   │   ├── layout.css       # Contenedor, navbar, tabs y modales
│   │   ├── components.css   # Botones, tablas, tarjetas, badges y toasts
│   │   └── main.css         # Archivo maestro que unifica los estilos
│   │
│   ├── types/               # Modelos e interfaces de datos (TypeScript)
│   │   ├── categoria.model.ts
│   │   ├── producto.model.ts
│   │   ├── venta.model.ts
│   │   ├── cart.model.ts
│   │   └── index.ts         # Exportador unificado de tipos
│   │
│   ├── services/            # Lógica de negocio y persistencia
│   │   ├── storage.service.ts      # Transacciones, validación de stock y almacenamiento
│   │   └── notification.service.ts # Mensajes emergentes (Toast)
│   │
│   ├── ui/                  # Vistas y controladores de interfaz
│   │   ├── modals.ts        # Control central de apertura/cierre de modales
│   │   ├── pos.view.ts      # Punto de Venta (Caja, selección de artículos y cobro)
│   │   ├── products.view.ts # Catálogo, creación y edición de productos
│   │   ├── categories.view.ts # Gestión de categorías
│   │   └── sales.view.ts    # Historial de ventas y desglose de tickets
│   │
│   └── main.ts              # Punto de entrada y orquestador de navegación
│
├── index.html               # Plantilla HTML semántica
├── package.json             # Dependencias y scripts de ejecución
├── tsconfig.json            # Configuración del compilador TypeScript
└── vite.config.ts           # Configuración del servidor de desarrollo y preview
```

---

## 🔄 Flujo de Datos

1. **Gestión de Inventario:**
   - La vista `CategoriesView` permite crear categorías limpias.
   - La vista `ProductsView` vincula cada producto a una categoría existente con su precio y stock.
   - Las operaciones se validan y almacenan mediante `DatabaseService`.

2. **Proceso de Venta (Caja / POS):**
   - El cajero selecciona productos en `PosView`.
   - Se calculan subtotales y total en tiempo real.
   - Al hacer clic en **"Registrar y Cobrar Venta"**:
     1. `DatabaseService.registrarVenta()` verifica que haya existencias suficientes de cada producto.
     2. Se descuenta el stock de la tabla `productos`.
     3. Se inserta el registro en `ventas` con fecha, hora y total.
     4. Se insertan los registros en `detalle_venta` con cada producto, cantidad y subtotal.
     5. Se notifica al usuario mediante `NotificationService`.
     6. Se actualiza el inventario y el historial de ventas en `SalesView`.
