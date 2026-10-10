import { Categoria, Producto, Venta, DetalleVenta, CartItem } from '../types';

export interface VentaDetalleResponse {
  venta: Venta;
  detalles: Array<DetalleVenta & { nombre_producto: string | null }>;
}

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...options?.headers
      }
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifica que el backend esté activo.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Error del servidor (${response.status}).`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/**
 * Acceso a los datos mediante la API del backend; la conexión SQL permanece en el servidor.
 */
export class DatabaseService {
  static getCategorias(): Promise<Categoria[]> {
    return request('/categorias');
  }

  static addCategoria(nombre: string): Promise<Categoria> {
    return request('/categorias', {
      method: 'POST',
      body: JSON.stringify({ nombre })
    });
  }

  static deleteCategoria(id: number): Promise<void> {
    return request(`/categorias/${id}`, { method: 'DELETE' });
  }

  static getProductos(): Promise<Producto[]> {
    return request('/productos');
  }

  static addProducto(data: Omit<Producto, 'id_producto'>): Promise<Producto> {
    return request('/productos', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static updateProducto(producto: Producto): Promise<Producto> {
    return request(`/productos/${producto.id_producto}`, {
      method: 'PUT',
      body: JSON.stringify(producto)
    });
  }

  static deleteProducto(id: number): Promise<void> {
    return request(`/productos/${id}`, { method: 'DELETE' });
  }

  static getVentas(): Promise<Venta[]> {
    return request('/ventas');
  }

  static getVentaDetalle(id: number): Promise<VentaDetalleResponse> {
    return request(`/ventas/${id}`);
  }

  static registrarVenta(items: CartItem[]): Promise<Venta> {
    return request('/ventas', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map(item => ({
          id_producto: item.producto.id_producto,
          cantidad: item.cantidad
        }))
      })
    });
  }
}

export interface AuthUser {
  id_usuario: number;
  nombre_usuario: string;
}

export class AuthService {
  static async getSession(): Promise<AuthUser | null> {
    const result = await request<{ user: AuthUser | null }>('/auth/session');
    return result.user;
  }

  static login(nombre_usuario: string, contrasena: string): Promise<{ user: AuthUser }> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nombre_usuario, contrasena })
    });
  }

  static register(nombre_usuario: string, contrasena: string): Promise<{ user: AuthUser }> {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nombre_usuario, contrasena })
    });
  }

  static logout(): Promise<void> {
    return request('/auth/logout', { method: 'POST' });
  }
}
