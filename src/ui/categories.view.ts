import { DatabaseService } from '../services/storage.service';
import { NotificationService } from '../services/notification.service';
import { ModalManager } from './modals';

export class CategoriesView {
  private static tableBody = document.getElementById('categories-table-body') as HTMLElement;
  private static form = document.getElementById('form-category') as HTMLFormElement;
  private static inputName = document.getElementById('cat-name') as HTMLInputElement;

  static init(onUpdate?: () => void): void {
    document.getElementById('open-new-category-modal')?.addEventListener('click', () => {
      ModalManager.openCategoryModal();
    });

    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.inputName.value.trim();
      if (!name) return;

      DatabaseService.addCategoria(name);
      NotificationService.success(`Categoría "${name}" creada exitosamente.`);
      ModalManager.closeCategoryModal();
      this.render();
      onUpdate?.();
    });
  }

  static render(): void {
    const categories = DatabaseService.getCategorias();
    const products = DatabaseService.getProductos();

    if (categories.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="empty-state">
              <div class="empty-state-icon">🏷️</div>
              <div class="empty-state-title">No hay categorías creadas</div>
              <div class="empty-state-text">Crea categorías para organizar tus productos ordenadamente.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    this.tableBody.innerHTML = '';
    categories.forEach(cat => {
      const prodCount = products.filter(p => p.id_categoria === cat.id_categoria).length;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${cat.id_categoria}</td>
        <td class="bold">${cat.nombre}</td>
        <td>${prodCount} artículo(s)</td>
        <td class="text-right">
          <button class="btn btn-danger btn-sm" data-delete-cat="${cat.id_categoria}">Eliminar</button>
        </td>
      `;

      tr.querySelector(`[data-delete-cat="${cat.id_categoria}"]`)?.addEventListener('click', () => {
        try {
          if (confirm(`¿Eliminar la categoría "${cat.nombre}"?`)) {
            DatabaseService.deleteCategoria(cat.id_categoria);
            NotificationService.success(`Categoría "${cat.nombre}" eliminada.`);
            this.render();
          }
        } catch (err: any) {
          NotificationService.error(err.message);
        }
      });

      this.tableBody.appendChild(tr);
    });
  }
}
