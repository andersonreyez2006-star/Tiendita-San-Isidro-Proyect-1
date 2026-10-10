import { ModalManager } from './ui/modals';
import { CategoriesView } from './ui/categories.view';
import { ProductsView } from './ui/products.view';
import { PosView } from './ui/pos.view';
import { SalesView } from './ui/sales.view';
import { AuthService, type AuthUser } from './services/storage.service';
import { NotificationService } from './services/notification.service';

// Estado de la pestaña activa
let currentTab: string = 'pos';
let applicationInitialized = false;

const authScreen = document.querySelector<HTMLElement>('#auth-screen')!;
const app = document.querySelector<HTMLElement>('#app')!;
const authForm = document.querySelector<HTMLFormElement>('#auth-form')!;
const authUsername = document.querySelector<HTMLInputElement>('#auth-username')!;
const authPassword = document.querySelector<HTMLInputElement>('#auth-password')!;
const authMessage = document.querySelector<HTMLElement>('#auth-message')!;
const authTitle = document.querySelector<HTMLElement>('#auth-title')!;
const authDescription = document.querySelector<HTMLElement>('#auth-description')!;
const authSubmit = document.querySelector<HTMLButtonElement>('#auth-submit')!;
const authToggle = document.querySelector<HTMLButtonElement>('#auth-toggle')!;
const authUserLabel = document.querySelector<HTMLElement>('#auth-user')!;
const logoutButton = document.querySelector<HTMLButtonElement>('#logout-button')!;
let registering = false;

authToggle.addEventListener('click', () => {
  registering = !registering;
  authTitle.textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
  authDescription.textContent = registering
    ? 'Cualquier persona puede registrarse y administrar todos los datos de la tienda.'
    : 'Ingresa con tu cuenta para continuar.';
  authSubmit.textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
  authToggle.textContent = registering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate';
  authPassword.autocomplete = registering ? 'new-password' : 'current-password';
  authMessage.textContent = '';
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';
  authSubmit.disabled = true;
  try {
    const username = authUsername.value.trim();
    const password = authPassword.value;
    const result = registering
      ? await AuthService.register(username, password)
      : await AuthService.login(username, password);
    authPassword.value = '';
    showApplication(result.user);
  } catch (error) {
    authMessage.textContent = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
  } finally {
    authSubmit.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await AuthService.logout();
    app.hidden = true;
    authScreen.hidden = false;
    authPassword.value = '';
    authMessage.textContent = '';
  } catch (error) {
    NotificationService.error(error instanceof Error ? error.message : 'No se pudo cerrar sesión.');
  } finally {
    logoutButton.disabled = false;
  }
});

void AuthService.getSession()
  .then(user => {
    if (user) showApplication(user);
  })
  .catch(error => {
    authMessage.textContent = error instanceof Error
      ? error.message
      : 'No se pudo conectar con el servidor.';
  });

function showApplication(user: AuthUser): void {
  authUserLabel.textContent = user.nombre_usuario;
  authScreen.hidden = true;
  app.hidden = false;
  if (applicationInitialized) return;
  applicationInitialized = true;
  initializeApplication();
}

function initializeApplication(): void {
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
}
