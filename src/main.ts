import { DatabaseStore } from './storage';
import { CartItem, Producto } from './types';

// Estado local de la aplicación
let activeTab: string = 'pos';
let cart: CartItem[] = [];
let editingProductId: number | null = null;

// Elementos del DOM
const tabs = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
const views = document.querySelectorAll<HTMLElement>('.view');

// POS Elements
const posProductsGrid = document.getElementById('pos-products-grid') as HTMLElement;
const posSearch = document.getElementById('pos-search') as HTMLInputElement;
const posCatFilter = document.getElementById('pos-cat-filter') as HTMLSelectElement;
const posCartItems = document.getElementById('pos-cart-items') as HTMLElement;
const cartItemCount = document.getElementById('cart-item-count') as HTMLElement;
const cartTotal = document.getElementById('cart-total') as HTMLElement;
const checkoutBtn = document.getElementById('checkout-btn') as HTMLButtonElement;
const clearCartBtn = document.getElementById('clear-cart-btn') as HTMLButtonElement;

// Tables
const productsTableBody = document.getElementById('products-table-body') as HTMLElement;
const categoriesTableBody = document.getElementById('categories-table-body') as HTMLElement;
const salesTableBody = document.getElementById('sales-table-body') as HTMLElement;
const salesGrandTotal = document.getElementById('sales-grand-total') as HTMLElement;

// Modals
const modalCategory = document.getElementById('modal-category') as HTMLElement;
const modalProduct = document.getElementById('modal-product') as HTMLElement;
const modalSaleDetail = document.getElementById('modal-sale-detail') as HTMLElement;

// Forms
const formCategory = document.getElementById('form-category') as HTMLFormElement;
const formProduct = document.getElementById('form-product') as HTMLFormElement;
const catNameInput = document.getElementById('cat-name') as HTMLInputElement;
const prodCategorySelect = document.getElementById('prod-category') as HTMLSelectElement;

// Toast Container
const toastContainer = document.getElementById('toast-container') as HTMLElement;

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// -------------------------------------------------------------
// NAVEGACIÓN POR TABS
// -------------------------------------------------------------
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    if (!target) return;

    tabs.forEach(t => t.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));

    tab.classList.add('active');
    const targetView = document.getElementById(`view-${target}`);
    if (targetView) targetView.classList.add('active');

    activeTab = target;
    refreshView();
  });
});

function refreshView() {
  if (activeTab === 'pos') {
    renderPosCatalog();
    renderPosFilters();
  } else if (activeTab === 'productos') {
    renderProductsTable();
  } else if (activeTab === 'categorias') {
    renderCategoriesTable();
  } else if (activeTab === 'ventas') {
    renderSalesTable();
  }
}

// -------------------------------------------------------------
// VISTA POS (CAJA / TICKET)
// -------------------------------------------------------------
function renderPosFilters() {
  const categories = DatabaseStore.getCategorias();
  const currentVal = posCatFilter.value;
  posCatFilter.innerHTML = '<option value="">Todas las categorías</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id_categoria.toString();
    opt.textContent = cat.nombre;
    posCatFilter.appendChild(opt);
  });
  posCatFilter.value = currentVal;
}

function renderPosCatalog() {
  const products = DatabaseStore.getProductos();
  const categories = DatabaseStore.getCategorias();
  const catMap = new Map(categories.map(c => [c.id_categoria, c.nombre]));

  const query = posSearch.value.toLowerCase().trim();
  const selectedCat = posCatFilter.value;

  const filtered = products.filter(p => {
    const matchName = p.nombre.toLowerCase().includes(query);
    const matchCat = !selectedCat || p.id_categoria.toString() === selectedCat;
    return matchName && matchCat;
  });

  if (products.length === 0) {
    posProductsGrid.innerHTML = `
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
    posProductsGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">No se encontraron productos</div>
        <div class="empty-state-text">Prueba con otro término de búsqueda o categoría.</div>
      </div>
    `;
    return;
  }

  posProductsGrid.innerHTML = '';
  filtered.forEach(p => {
    const card = document.createElement('div');
    const isOutOfStock = p.stock <= 0;
    card.className = `product-card ${isOutOfStock ? 'out-of-stock' : ''}`;
    card.innerHTML = `
      <div>
        <div class="product-card-title">${p.nombre}</div>
        <div class="product-card-cat">${catMap.get(p.id_categoria) || 'Sin Categoría'}</div>
      </div>
      <div class="product-card-footer">
        <span class="product-card-price">$${p.precio_venta.toFixed(2)}</span>
        <span class="product-card-stock">${isOutOfStock ? 'Agotado' : `Stock: ${p.stock}`}</span>
      </div>
    `;

    if (!isOutOfStock) {
      card.addEventListener('click', () => addToCart(p));
    }
    posProductsGrid.appendChild(card);
  });
}

function addToCart(producto: Producto) {
  const existing = cart.find(item => item.producto.id_producto === producto.id_producto);
  if (existing) {
    if (existing.cantidad + 1 > producto.stock) {
      showToast(`No hay más existencias disponibles de "${producto.nombre}".`, 'error');
      return;
    }
    existing.cantidad += 1;
  } else {
    cart.push({ producto, cantidad: 1 });
  }
  renderCart();
}

function updateCartQuantity(productId: number, delta: number) {
  const item = cart.find(i => i.producto.id_producto === productId);
  if (!item) return;

  const newQty = item.cantidad + delta;
  if (newQty <= 0) {
    cart = cart.filter(i => i.producto.id_producto !== productId);
  } else {
    if (newQty > item.producto.stock) {
      showToast(`Stock máximo alcanzado para "${item.producto.nombre}".`, 'error');
      return;
    }
    item.cantidad = newQty;
  }
  renderCart();
}

function renderCart() {
  if (cart.length === 0) {
    posCartItems.innerHTML = `
      <div class="empty-state" style="padding: 2rem 1rem;">
        <div class="empty-state-icon">🛒</div>
        <div class="empty-state-title">Carrito Vacío</div>
        <div class="empty-state-text">Haz clic en los productos para agregarlos al ticket.</div>
      </div>
    `;
    cartItemCount.textContent = '0';
    cartTotal.textContent = '$0.00';
    checkoutBtn.disabled = true;
    return;
  }

  posCartItems.innerHTML = '';
  let totalCount = 0;
  let totalMonto = 0;

  cart.forEach(item => {
    const subtotal = item.producto.precio_venta * item.cantidad;
    totalCount += item.cantidad;
    totalMonto += subtotal;

    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${item.producto.nombre}</div>
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
      updateCartQuantity(item.producto.id_producto, -1);
    });

    row.querySelector('[data-action="plus"]')?.addEventListener('click', () => {
      updateCartQuantity(item.producto.id_producto, 1);
    });

    posCartItems.appendChild(row);
  });

  cartItemCount.textContent = totalCount.toString();
  cartTotal.textContent = `$${totalMonto.toFixed(2)}`;
  checkoutBtn.disabled = false;
}

checkoutBtn.addEventListener('click', () => {
  try {
    const venta = DatabaseStore.registrarVenta(cart);
    showToast(`¡Venta #${venta.id_venta} registrada por $${venta.total.toFixed(2)}!`, 'success');
    cart = [];
    renderCart();
    renderPosCatalog();
  } catch (err: any) {
    showToast(err.message || 'Error al registrar la venta.', 'error');
  }
});

clearCartBtn.addEventListener('click', () => {
  if (cart.length > 0) {
    cart = [];
    renderCart();
  }
});

posSearch.addEventListener('input', () => renderPosCatalog());
posCatFilter.addEventListener('change', () => renderPosCatalog());

// -------------------------------------------------------------
// VISTA PRODUCTOS
// -------------------------------------------------------------
function renderProductsTable() {
  const products = DatabaseStore.getProductos();
  const categories = DatabaseStore.getCategorias();
  const catMap = new Map(categories.map(c => [c.id_categoria, c.nombre]));

  if (products.length === 0) {
    productsTableBody.innerHTML = `
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

  productsTableBody.innerHTML = '';
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
      <td class="bold">${p.nombre}</td>
      <td>${catMap.get(p.id_categoria) || 'Sin Categoría'}</td>
      <td>$${p.precio_venta.toFixed(2)}</td>
      <td>${p.stock}</td>
      <td>${stockBadge}</td>
      <td class="text-right">
        <button class="btn btn-secondary btn-sm" data-edit="${p.id_producto}">Editar</button>
        <button class="btn btn-danger btn-sm" data-delete="${p.id_producto}">Eliminar</button>
      </td>
    `;

    tr.querySelector(`[data-edit="${p.id_producto}"]`)?.addEventListener('click', () => {
      openProductModal(p);
    });

    tr.querySelector(`[data-delete="${p.id_producto}"]`)?.addEventListener('click', () => {
      if (confirm(`¿Estás seguro de eliminar el producto "${p.nombre}"?`)) {
        DatabaseStore.deleteProducto(p.id_producto);
        showToast(`Producto "${p.nombre}" eliminado.`, 'success');
        renderProductsTable();
      }
    });

    productsTableBody.appendChild(tr);
  });
}

function openProductModal(producto?: Producto) {
  const categories = DatabaseStore.getCategorias();
  if (categories.length === 0) {
    showToast('Debes crear al menos una categoría antes de registrar productos.', 'error');
    openCategoryModal();
    return;
  }

  // Llenar select de categorías
  prodCategorySelect.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>';
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id_categoria.toString();
    opt.textContent = c.nombre;
    prodCategorySelect.appendChild(opt);
  });

  const modalTitle = document.getElementById('modal-product-title') as HTMLElement;
  const prodName = document.getElementById('prod-name') as HTMLInputElement;
  const prodPrice = document.getElementById('prod-price') as HTMLInputElement;
  const prodStock = document.getElementById('prod-stock') as HTMLInputElement;

  if (producto) {
    editingProductId = producto.id_producto;
    modalTitle.textContent = 'Editar Producto';
    prodName.value = producto.nombre;
    prodCategorySelect.value = producto.id_categoria.toString();
    prodPrice.value = producto.precio_venta.toString();
    prodStock.value = producto.stock.toString();
  } else {
    editingProductId = null;
    modalTitle.textContent = 'Nuevo Producto';
    formProduct.reset();
  }

  modalProduct.classList.add('active');
}

formProduct.addEventListener('submit', (e) => {
  e.preventDefault();
  const prodName = (document.getElementById('prod-name') as HTMLInputElement).value;
  const prodCat = Number(prodCategorySelect.value);
  const prodPrice = Number((document.getElementById('prod-price') as HTMLInputElement).value);
  const prodStock = Number((document.getElementById('prod-stock') as HTMLInputElement).value);

  if (editingProductId) {
    DatabaseStore.updateProducto({
      id_producto: editingProductId,
      nombre: prodName,
      id_categoria: prodCat,
      precio_venta: prodPrice,
      stock: prodStock
    });
    showToast('Producto actualizado exitosamente.');
  } else {
    DatabaseStore.addProducto({
      nombre: prodName,
      id_categoria: prodCat,
      precio_venta: prodPrice,
      stock: prodStock
    });
    showToast('Producto registrado exitosamente.');
  }

  modalProduct.classList.remove('active');
  formProduct.reset();
  renderProductsTable();
});

document.getElementById('open-new-product-modal')?.addEventListener('click', () => openProductModal());

// -------------------------------------------------------------
// VISTA CATEGORÍAS
// -------------------------------------------------------------
function renderCategoriesTable() {
  const categories = DatabaseStore.getCategorias();
  const products = DatabaseStore.getProductos();

  if (categories.length === 0) {
    categoriesTableBody.innerHTML = `
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

  categoriesTableBody.innerHTML = '';
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
          DatabaseStore.deleteCategoria(cat.id_categoria);
          showToast(`Categoría "${cat.nombre}" eliminada.`, 'success');
          renderCategoriesTable();
        }
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    });

    categoriesTableBody.appendChild(tr);
  });
}

function openCategoryModal() {
  formCategory.reset();
  modalCategory.classList.add('active');
  catNameInput.focus();
}

formCategory.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = catNameInput.value.trim();
  if (!name) return;

  DatabaseStore.addCategoria(name);
  showToast(`Categoría "${name}" creada con éxito.`);
  modalCategory.classList.remove('active');
  formCategory.reset();
  renderCategoriesTable();
});

document.getElementById('open-new-category-modal')?.addEventListener('click', () => openCategoryModal());

// -------------------------------------------------------------
// VISTA VENTAS E HISTORIAL
// -------------------------------------------------------------
function renderSalesTable() {
  const ventas = DatabaseStore.getVentas();
  const grandTotal = ventas.reduce((sum, v) => sum + v.total, 0);
  salesGrandTotal.textContent = `$${grandTotal.toFixed(2)}`;

  if (ventas.length === 0) {
    salesTableBody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">
            <div class="empty-state-icon">📜</div>
            <div class="empty-state-title">Aún no hay ventas registradas</div>
            <div class="empty-state-text">Los tickets cobrados en el Punto de Venta aparecerán aquí.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  salesTableBody.innerHTML = '';
  ventas.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">Ticket #${v.id_venta}</td>
      <td>${v.fecha_hora}</td>
      <td class="bold" style="color: var(--primary);">$${v.total.toFixed(2)}</td>
      <td class="text-right">
        <button class="btn btn-secondary btn-sm" data-view-ticket="${v.id_venta}">Ver Desglose</button>
      </td>
    `;

    tr.querySelector(`[data-view-ticket="${v.id_venta}"]`)?.addEventListener('click', () => {
      openTicketModal(v);
    });

    salesTableBody.appendChild(tr);
  });
}

function openTicketModal(venta: any) {
  const detalles = DatabaseStore.getDetalles().filter(d => d.id_venta === venta.id_venta);
  const productos = DatabaseStore.getProductos();
  const prodMap = new Map(productos.map(p => [p.id_producto, p.nombre]));

  (document.getElementById('modal-ticket-title') as HTMLElement).textContent = `Ticket #${venta.id_venta}`;
  (document.getElementById('ticket-date') as HTMLElement).textContent = venta.fecha_hora;
  (document.getElementById('ticket-total-display') as HTMLElement).textContent = `$${venta.total.toFixed(2)}`;

  const body = document.getElementById('ticket-items-body') as HTMLElement;
  body.innerHTML = '';

  detalles.forEach(d => {
    const unitPrice = d.subtotal / d.cantidad;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${prodMap.get(d.id_producto) || `Producto ID #${d.id_producto}`}</td>
      <td>${d.cantidad}</td>
      <td>$${unitPrice.toFixed(2)}</td>
      <td class="text-right bold">$${d.subtotal.toFixed(2)}</td>
    `;
    body.appendChild(tr);
  });

  modalSaleDetail.classList.add('active');
}

// -------------------------------------------------------------
// CIERRE DE MODALES
// -------------------------------------------------------------
document.querySelectorAll('.close-modal').forEach(btn => {
  btn.addEventListener('click', () => {
    modalCategory.classList.remove('active');
    modalProduct.classList.remove('active');
    modalSaleDetail.classList.remove('active');
  });
});

window.addEventListener('click', (e) => {
  if (e.target === modalCategory) modalCategory.classList.remove('active');
  if (e.target === modalProduct) modalProduct.classList.remove('active');
  if (e.target === modalSaleDetail) modalSaleDetail.classList.remove('active');
});

// Inicialización
refreshView();
renderCart();
