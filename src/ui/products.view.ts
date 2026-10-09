import { DatabaseService } from '../services/storage.service';
import { NotificationService } from '../services/notification.service';
import { Categoria, Producto } from '../types';
import { ModalManager } from './modals';
import { escapeHtml } from './html';

export class ProductsView {
  private static tableBody = document.getElementById('products-table-body') as HTMLElement;
  private static form = document.getElementById('form-product') as HTMLFormElement;
  private static selectCat = document.getElementById('prod-category') as HTMLSelectElement;
  private static inputName = document.getElementById('prod-name') as HTMLInputElement;
  private static inputPrice = document.getElementById('prod-price') as HTMLInputElement;
  private static inputStock = document.getElementById('prod-stock') as HTMLInputElement;
  private static modalTitle = document.getElementById('modal-product-title') as HTMLElement;

  private static editingId: number | null = null;

  static init(onUpdate?: () => void | Promise<void>): void {
    document.getElementById('open-new-product-modal')?.addEventListener('click', () => {
      void this.openModal();
    });

    this.form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = this.inputName.value.trim();
      const catId = Number(this.selectCat.value);
      const price = Number(this.inputPrice.value);
      const stock = Number(this.inputStock.value);

      try {
        if (this.editingId) {
          await DatabaseService.updateProducto({
            id_producto: this.editingId,
            nombre: name,
            id_categoria: catId,
            precio_venta: price,
            stock
          });
          NotificationService.success('Producto actualizado exitosamente.');
        } else {
          await DatabaseService.addProducto({
            nombre: name,
            id_categoria: catId,
            precio_venta: price,
            stock
          });
          NotificationService.success('Producto registrado exitosamente.');
        }

        ModalManager.closeProductModal();
        await this.render();
        await onUpdate?.();
      } catch (err) {
        NotificationService.error(err instanceof Error ? err.message : 'No se pudo guardar el producto.');
      }
    });
  }

  static async openModal(producto?: Producto): Promise<void> {
    let categories: Categoria[];
    try {
      categories = await DatabaseService.getCategorias();
    } catch (err) {
      NotificationService.error(err instanceof Error ? err.message : 'No se pudieron cargar las categorías.');
      return;
    }
    if (categories.length === 0) {
      NotificationService.error('Debes crear al menos una categoría antes de registrar productos.');
      ModalManager.openCategoryModal();
      return;
    }

    // Actualizar opciones de categoría
    this.selectCat.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>';
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id_categoria.toString();
      opt.textContent = c.nombre;
      this.selectCat.appendChild(opt);
    });

    if (producto) {
      this.editingId = producto.id_producto;
      this.modalTitle.textContent = 'Editar Producto';
      this.inputName.value = producto.nombre;
      this.selectCat.value = producto.id_categoria.toString();
      this.inputPrice.value = producto.precio_venta.toString();
      this.inputStock.value = producto.stock.toString();
    } else {
      this.editingId = null;
      this.modalTitle.textContent = 'Nuevo Producto';
      this.form.reset();
    }

    ModalManager.openProductModal();
  }

  static async render(): Promise<void> {
    let products: Producto[];
    let categories: Categoria[];
    try {
      [products, categories] = await Promise.all([
        DatabaseService.getProductos(),
        DatabaseService.getCategorias()
      ]);
    } catch (err) {
      NotificationService.error(err instanceof Error ? err.message : 'No se pudieron cargar los productos.');
      return;
    }
    const catMap = new Map(categories.map(c => [c.id_categoria, c.nombre]));

    if (products.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <div class="empty-state-icon">📦</div>
              <div class="empty-state-title">No hay productos registrados</div>
              <div class="empty-state-text">Comienza creando una categoría y agregando tu primer producto.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    this.tableBody.innerHTML = '';
    products.forEach(p => {
      let stockBadge = '<span class="badge badge-success">En Stock</span>';
      if (p.stock <= 0) {
        stockBadge = '<span class="badge badge-danger">Agotado</span>';
      } else if (p.stock <= 5) {
        stockBadge = '<span class="badge badge-warning">Bajo Stock</span>';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${p.id_producto}</td>
        <td class="bold">${escapeHtml(p.nombre)}</td>
        <td>${escapeHtml(catMap.get(p.id_categoria) || 'Sin Categoría')}</td>
        <td>$${p.precio_venta.toFixed(2)}</td>
        <td>${p.stock}</td>
        <td>${stockBadge}</td>
        <td class="text-right">
          <button class="btn btn-secondary btn-sm" data-edit="${p.id_producto}">Editar</button>
          <button class="btn btn-danger btn-sm" data-delete="${p.id_producto}">Eliminar</button>
        </td>
      `;

      tr.querySelector(`[data-edit="${p.id_producto}"]`)?.addEventListener('click', () => {
        void this.openModal(p);
      });

      tr.querySelector(`[data-delete="${p.id_producto}"]`)?.addEventListener('click', async () => {
        if (confirm(`¿Estás seguro de eliminar el producto "${p.nombre}"?`)) {
          try {
            await DatabaseService.deleteProducto(p.id_producto);
            NotificationService.success(`Producto "${p.nombre}" eliminado.`);
            await this.render();
          } catch (err) {
            NotificationService.error(err instanceof Error ? err.message : 'No se pudo eliminar el producto.');
          }
        }
      });

      this.tableBody.appendChild(tr);
    });
  }
}
