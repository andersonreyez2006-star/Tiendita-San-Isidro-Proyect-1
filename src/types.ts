// Tipos que reflejan exactamente el esquema de la base de datos de Tiendita San Isidro

export interface Categoria {
  id_categoria: number;
  nombre: string;
}

export interface Producto {
  id_producto: number;
  nombre: string;
  precio_venta: number;
  stock: number;
  id_categoria: number;
}

export interface Venta {
  id_venta: number;
  fecha_hora: string;
  total: number;
}

export interface DetalleVenta {
  id_detalle: number;
  id_venta: number;
  id_producto: number;
  cantidad: number;
  subtotal: number;
}

export interface CartItem {
  producto: Producto;
  cantidad: number;
}
