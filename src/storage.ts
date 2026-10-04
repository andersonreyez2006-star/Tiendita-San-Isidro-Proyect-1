import { Categoria, Producto, Venta, DetalleVenta, CartItem } from './types';

const STORAGE_KEYS = {
  CATEGORIAS: 'tiendita_categorias',
  PRODUCTOS: 'tiendita_productos',
  VENTAS: 'tiendita_ventas',
  DETALLE_VENTAS: 'tiendita_detalle_ventas'
};

export class DatabaseStore {
  // Categorias
  static getCategorias(): Categoria[] {
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIAS);
    return data ? JSON.parse(data) : [];
  }

  static addCategoria(nombre: string): Categoria {
    const list = this.getCategorias();
    const nextId = list.length > 0 ? Math.max(...list.map(c => c.id_categoria)) + 1 : 1;
    const nueva: Categoria = { id_categoria: nextId, nombre: nombre.trim() };
    list.push(nueva);
    localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(list));
    return nueva;
  }

  static deleteCategoria(id: number): boolean {
    const productos = this.getProductos();
    const hasProducts = productos.some(p => p.id_categoria === id);
    if (hasProducts) {
      throw new Error('No se puede eliminar la categoría porque tiene productos asignados.');
    }
    const list = this.getCategorias().filter(c => c.id_categoria !== id);
    localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(list));
    return true;
  }

  // Productos
  static getProductos(): Producto[] {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTOS);
    return data ? JSON.parse(data) : [];
  }

  static addProducto(data: Omit<Producto, 'id_producto'>): Producto {
    const list = this.getProductos();
    const nextId = list.length > 0 ? Math.max(...list.map(p => p.id_producto)) + 1 : 1;
    const nuevo: Producto = {
      id_producto: nextId,
      nombre: data.nombre.trim(),
      precio_venta: Number(data.precio_venta),
      stock: Number(data.stock),
      id_categoria: Number(data.id_categoria)
    };
    list.push(nuevo);
    localStorage.setItem(STORAGE_KEYS.PRODUCTOS, JSON.stringify(list));
    return nuevo;
  }

  static updateProducto(producto: Producto): void {
    const list = this.getProductos().map(p => (p.id_producto === producto.id_producto ? producto : p));
    localStorage.setItem(STORAGE_KEYS.PRODUCTOS, JSON.stringify(list));
  }

  static deleteProducto(id: number): void {
    const list = this.getProductos().filter(p => p.id_producto !== id);
    localStorage.setItem(STORAGE_KEYS.PRODUCTOS, JSON.stringify(list));
  }

  // Ventas y Detalle_Venta
  static getVentas(): Venta[] {
    const data = localStorage.getItem(STORAGE_KEYS.VENTAS);
    return data ? JSON.parse(data) : [];
  }

  static getDetalles(): DetalleVenta[] {
    const data = localStorage.getItem(STORAGE_KEYS.DETALLE_VENTAS);
    return data ? JSON.parse(data) : [];
  }

  static registrarVenta(items: CartItem[]): Venta {
    if (items.length === 0) {
      throw new Error('El carrito está vacío.');
    }

    // Verificar y descontar stock
    const productos = this.getProductos();
    for (const item of items) {
      const prod = productos.find(p => p.id_producto === item.producto.id_producto);
      if (!prod) {
        throw new Error(`El producto con ID ${item.producto.id_producto} no fue encontrado.`);
      }
      if (prod.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock}`);
      }
      prod.stock -= item.cantidad;
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCTOS, JSON.stringify(productos));

    // Crear Venta
    const ventas = this.getVentas();
    const nextVentaId = ventas.length > 0 ? Math.max(...ventas.map(v => v.id_venta)) + 1 : 1;
    const total = items.reduce((sum, item) => sum + (item.producto.precio_venta * item.cantidad), 0);

    const now = new Date();
    const fechaHora = now.toLocaleString('es-SV', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const nuevaVenta: Venta = {
      id_venta: nextVentaId,
      fecha_hora: fechaHora,
      total: Number(total.toFixed(2))
    };
    ventas.unshift(nuevaVenta);
    localStorage.setItem(STORAGE_KEYS.VENTAS, JSON.stringify(ventas));

    // Crear Detalle_Venta
    const detalles = this.getDetalles();
    let nextDetalleId = detalles.length > 0 ? Math.max(...detalles.map(d => d.id_detalle)) + 1 : 1;

    for (const item of items) {
      const subtotal = Number((item.producto.precio_venta * item.cantidad).toFixed(2));
      const nuevoDetalle: DetalleVenta = {
        id_detalle: nextDetalleId++,
        id_venta: nextVentaId,
        id_producto: item.producto.id_producto,
        cantidad: item.cantidad,
        subtotal: subtotal
      };
      detalles.push(nuevoDetalle);
    }
    localStorage.setItem(STORAGE_KEYS.DETALLE_VENTAS, JSON.stringify(detalles));

    return nuevaVenta;
  }
}
