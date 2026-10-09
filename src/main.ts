import { ModalManager } from './ui/modals';
import { CategoriesView } from './ui/categories.view';
import { ProductsView } from './ui/products.view';
import { PosView } from './ui/pos.view';
import { SalesView } from './ui/sales.view';

// Estado de la pestaña activa
let currentTab: string = 'pos';

// Inicialización de componentes UI
ModalManager.init();

CategoriesView.init(async () => {
  await Promise.all([PosView.render(), ProductsView.render()]);
});

ProductsView.init(async () => {
  await Promise.all([PosView.render(), CategoriesView.render()]);
});

PosView.init(async () => {
  await Promise.all([SalesView.render(), ProductsView.render()]);
});

SalesView.init();

// Manejador de navegación entre pestañas
const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
const views = document.querySelectorAll<HTMLElement>('.view');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const targetTab = button.dataset.tab;
    if (!targetTab) return;

    tabButtons.forEach(btn => btn.classList.remove('active'));
    views.forEach(view => view.classList.remove('active'));

    button.classList.add('active');
    document.getElementById(`view-${targetTab}`)?.classList.add('active');

    currentTab = targetTab;
    updateActiveView();
  });
});

function updateActiveView(): void {
  switch (currentTab) {
    case 'pos':
      void PosView.render();
      break;
    case 'productos':
      void ProductsView.render();
      break;
    case 'categorias':
      void CategoriesView.render();
      break;
    case 'ventas':
      void SalesView.render();
      break;
  }
}

// Carga inicial
updateActiveView();
