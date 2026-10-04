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
