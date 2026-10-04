import { ModalManager } from './ui/modals';
import { CategoriesView } from './ui/categories.view';
import { ProductsView } from './ui/products.view';
import { PosView } from './ui/pos.view';
import { SalesView } from './ui/sales.view';

// Estado de la pestaña activa
let currentTab: string = 'pos';

// Inicialización de componentes UI
ModalManager.init();

CategoriesView.init(() => {
  PosView.render();
  ProductsView.render();
});

ProductsView.init(() => {
  PosView.render();
  CategoriesView.render();
});

PosView.init(() => {
  SalesView.render();
  ProductsView.render();
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
      PosView.render();
      break;
    case 'productos':
      ProductsView.render();
      break;
    case 'categorias':
      CategoriesView.render();
      break;
    case 'ventas':
      SalesView.render();
      break;
  }
}

// Carga inicial
updateActiveView();
