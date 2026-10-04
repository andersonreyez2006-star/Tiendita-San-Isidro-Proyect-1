/**
 * Manejador centralizado de ventanas modales
 */
export class ModalManager {
  static modalCategory = document.getElementById('modal-category') as HTMLElement;
  static modalProduct = document.getElementById('modal-product') as HTMLElement;
  static modalSaleDetail = document.getElementById('modal-sale-detail') as HTMLElement;

  static init(): void {
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => this.closeAll());
    });

    window.addEventListener('click', (e) => {
      if (
        e.target === this.modalCategory ||
        e.target === this.modalProduct ||
        e.target === this.modalSaleDetail
      ) {
        this.closeAll();
      }
    });
  }

  static openCategoryModal(): void {
    const form = document.getElementById('form-category') as HTMLFormElement;
    form?.reset();
    this.modalCategory.classList.add('active');
    (document.getElementById('cat-name') as HTMLInputElement)?.focus();
  }

  static closeCategoryModal(): void {
    this.modalCategory.classList.remove('active');
  }

  static openProductModal(): void {
    this.modalProduct.classList.add('active');
  }

  static closeProductModal(): void {
    this.modalProduct.classList.remove('active');
  }

  static openSaleDetailModal(): void {
    this.modalSaleDetail.classList.add('active');
  }

  static closeSaleDetailModal(): void {
    this.modalSaleDetail.classList.remove('active');
  }

  static closeAll(): void {
    this.modalCategory.classList.remove('active');
    this.modalProduct.classList.remove('active');
    this.modalSaleDetail.classList.remove('active');
  }
}
