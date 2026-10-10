import { DatabaseService } from '../services/storage.service';
import { NotificationService } from '../services/notification.service';
import { CartItem, Categoria, Producto } from '../types';
import { escapeHtml } from './html';
import { renderDataError } from './data-error';

export class PosView {
  private static productsGrid = document.getElementById('pos-products-grid') as HTMLElement;
  private static searchInput = document.getElementById('pos-search') as HTMLInputElement;
  private static catFilter = document.getElementById('pos-cat-filter') as HTMLSelectElement;
  private static cartItemsContainer = document.getElementById('pos-cart-items') as HTMLElement;
  private static cartItemCount = document.getElementById('cart-item-count') as HTMLElement;
  private static cartTotal = document.getElementById('cart-total') as HTMLElement;
  private static checkoutBtn = document.getElementById('checkout-btn') as HTMLButtonElement;
  private static clearCartBtn = document.getElementById('clear-cart-btn') as HTMLButtonElement;

  private static cart: CartItem[] = [];

  static init(onSaleCompleted?: () => void): void {
    this.searchInput?.addEventListener('input', () => void this.renderCatalog());
    this.catFilter?.addEventListener('change', () => void this.renderCatalog());

    this.clearCartBtn?.addEventListener('click', () => {
      if (this.cart.length > 0) {
        this.cart = [];
        this.renderCart();
      }
    });

    this.checkoutBtn?.addEventListener('click', async () => {
      try {
        const venta = await DatabaseService.registrarVenta(this.cart);
        NotificationService.success(`¡Venta #${venta.id_venta} registrada por $${venta.total.toFixed(2)}!`);
        this.cart = [];
        this.renderCart();
        await this.renderCatalog();
        await onSaleCompleted?.();
      } catch (err) {
        NotificationService.error(err instanceof Error ? err.message : 'Error al procesar la venta.');
      }
    });
  }

  static async render(): Promise<void> {
    await Promise.all([this.renderFilters(), this.renderCatalog()]);
    this.renderCart();
  }

  private static async renderFilters(): Promise<void> {
    let categories: Categoria[];
    try {
      categories = await DatabaseService.getCategorias();
    } catch (err) {
      NotificationService.error(err instanceof Error ? err.message : 'No se pudieron cargar las categorías.');
      return;
    }
    const currentVal = this.catFilter.value;
    this.catFilter.innerHTML = '<option value="">Todas las categorías</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id_categoria.toString();
      opt.textContent = cat.nombre;
      this.catFilter.appendChild(opt);
    });
    this.catFilter.value = currentVal;
  }

  static async renderCatalog(): Promise<void> {
    let products: Producto[];
    let categories: Categoria[];
    try {
      [products, categories] = await Promise.all([
        DatabaseService.getProductos(),
        DatabaseService.getCategorias()
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el catálogo.';
      renderDataError(this.productsGrid, message, () => void this.renderCatalog());
      return;
    }
    const catMap = new Map(categories.map(c => [c.id_categoria, c.nombre]));

    const query = this.searchInput.value.toLowerCase().trim();
    const selectedCat = this.catFilter.value;

    const filtered = products.filter(p => {
      const matchName = p.nombre.toLowerCase().includes(query);
      const matchCat = !selectedCat || p.id_categoria.toString() === selectedCat;
      return matchName && matchCat;
    });

    if (products.length === 0) {
      this.productsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🏪</div>
          <div class="empty-state-title">Aún no hay productos registrados</div>
          <div class="empty-state-text">
            Agrega tus categorías y productos en sus respectivas pestañas para comenzar a vender.
          </div>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      this.productsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">No se encontraron productos</div>
          <div class="empty-state-text">Prueba con otro término de búsqueda o categoría.</div>
        </div>
      `;
      return;
    }

    this.productsGrid.innerHTML = '';
    filtered.forEach(p => {
      const card = document.createElement('div');
      const isOutOfStock = p.stock <= 0;
      card.className = `product-card ${isOutOfStock ? 'out-of-stock' : ''}`;
      card.innerHTML = `
        <div>
          <div class="product-card-title">${escapeHtml(p.nombre)}</div>
          <div class="product-card-cat">${escapeHtml(catMap.get(p.id_categoria) || 'Sin Categoría')}</div>
        </div>
        <div class="product-card-footer">
          <span class="product-card-price">$${p.precio_venta.toFixed(2)}</span>
          <span class="product-card-stock">${isOutOfStock ? 'Agotado' : `Stock: ${p.stock}`}</span>
        </div>
      `;

      if (!isOutOfStock) {
        card.addEventListener('click', () => this.addToCart(p));
      }
      this.productsGrid.appendChild(card);
    });
  }

  private static addToCart(producto: Producto): void {
    const existing = this.cart.find(item => item.producto.id_producto === producto.id_producto);
    if (existing) {
      if (existing.cantidad + 1 > producto.stock) {
        NotificationService.error(`No hay más existencias disponibles de "${producto.nombre}".`);
        return;
      }
      existing.cantidad += 1;
    } else {
      this.cart.push({ producto, cantidad: 1 });
    }
    this.renderCart();
  }

  private static updateQuantity(productId: number, delta: number): void {
    const item = this.cart.find(i => i.producto.id_producto === productId);
    if (!item) return;

    const newQty = item.cantidad + delta;
    if (newQty <= 0) {
      this.cart = this.cart.filter(i => i.producto.id_producto !== productId);
    } else {
      if (newQty > item.producto.stock) {
        NotificationService.error(`Stock máximo alcanzado para "${item.producto.nombre}".`);
        return;
      }
      item.cantidad = newQty;
    }
    this.renderCart();
  }

  private static renderCart(): void {
    if (this.cart.length === 0) {
      this.cartItemsContainer.innerHTML = `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <div class="empty-state-icon">🛒</div>
          <div class="empty-state-title">Carrito Vacío</div>
          <div class="empty-state-text">Haz clic en los productos para agregarlos al ticket.</div>
        </div>
      `;
      this.cartItemCount.textContent = '0';
      this.cartTotal.textContent = '$0.00';
      this.checkoutBtn.disabled = true;
      return;
    }

    this.cartItemsContainer.innerHTML = '';
    let totalCount = 0;
    let totalMonto = 0;

    this.cart.forEach(item => {
      const subtotal = item.producto.precio_venta * item.cantidad;
      totalCount += item.cantidad;
      totalMonto += subtotal;

      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.producto.nombre)}</div>
          <div class="cart-item-price">$${item.producto.precio_venta.toFixed(2)} c/u</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-action="minus" data-id="${item.producto.id_producto}">-</button>
          <span class="cart-item-qty">${item.cantidad}</span>
          <button class="qty-btn" data-action="plus" data-id="${item.producto.id_producto}">+</button>
        </div>
        <div class="cart-item-subtotal">$${subtotal.toFixed(2)}</div>
      `;

      row.querySelector('[data-action="minus"]')?.addEventListener('click', () => {
        this.updateQuantity(item.producto.id_producto, -1);
      });

      row.querySelector('[data-action="plus"]')?.addEventListener('click', () => {
        this.updateQuantity(item.producto.id_producto, 1);
      });

      this.cartItemsContainer.appendChild(row);
    });

    this.cartItemCount.textContent = totalCount.toString();
    this.cartTotal.textContent = `$${totalMonto.toFixed(2)}`;
    this.checkoutBtn.disabled = false;
  }
}
