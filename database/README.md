# 🗄️ Base de Datos - Tiendita San Isidro

Este directorio contiene los scripts y definiciones de la base de datos relacional para el sistema de **Tiendita San Isidro**.

---

## 📁 Archivos en este directorio
- **[`schema.sql`](file:///c:/Users/ander/OneDrive%20-%20Universidad%20Don%20Bosco/Escritorio/Tiendita%20San%20Isidro/database/schema.sql)**: Esquema relacional DDL sin datos dummy, compatible con **MySQL / MariaDB**.

---

## 📋 Tablas y Relaciones

1. **`categorias`**:
   - `id_categoria`: Llave primaria autoincremental (`INT`).
   - `nombre`: Nombre descriptivo de la categoría (`VARCHAR(100)`).

2. **`productos`**:
   - `id_producto`: Llave primaria autoincremental (`INT`).
   - `nombre`: Nombre del producto (`VARCHAR(150)`).
   - `precio_venta`: Precio monetario (`DECIMAL(10, 2)`).
   - `stock`: Cantidad en inventario (`INT`).
   - `id_categoria`: Llave foránea (`FK`) vinculada a `categorias(id_categoria)`.

3. **`ventas`**:
   - `id_venta`: Llave primaria autoincremental (`INT`).
   - `fecha_hora`: Fecha y hora del ticket (`DATETIME`).
   - `total`: Monto total de la venta (`DECIMAL(10, 2)`).

4. **`detalle_venta`**:
   - `id_detalle`: Llave primaria autoincremental (`INT`).
   - `id_venta`: Llave foránea (`FK`) vinculada a `ventas(id_venta)`.
   - `id_producto`: Llave foránea (`FK`) vinculada a `productos(id_producto)`.
   - `cantidad`: Unidades vendidas (`INT`).
   - `subtotal`: Precio unitario $\times$ cantidad (`DECIMAL(10, 2)`).

---

## 🚀 Cómo importar en tu Hosting (cPanel / phpMyAdmin)
1. Entra al panel de tu hosting (cPanel, Hostinger, etc.).
2. Abre la herramienta **phpMyAdmin**.
3. Crea una base de datos nueva (ejemplo: `tiendita_san_isidro`).
4. Ve a la pestaña **Importar** (Import).
5. Selecciona el archivo [`schema.sql`](file:///c:/Users/ander/OneDrive%20-%20Universidad%20Don%20Bosco/Escritorio/Tiendita%20San%20Isidro/database/schema.sql) y haz clic en **Continuar / Importar**.
