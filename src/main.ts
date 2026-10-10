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
const recoveryScreen = document.querySelector<HTMLElement>('#recovery-screen')!;
const accountScreen = document.querySelector<HTMLElement>('#account-screen')!;
const app = document.querySelector<HTMLElement>('#app')!;
const authForm = document.querySelector<HTMLFormElement>('#auth-form')!;
const authUsername = document.querySelector<HTMLInputElement>('#auth-username')!;
const authPassword = document.querySelector<HTMLInputElement>('#auth-password')!;
const authEmail = document.querySelector<HTMLInputElement>('#auth-email')!;
const authEmailGroup = document.querySelector<HTMLElement>('#auth-email-group')!;
const authMessage = document.querySelector<HTMLElement>('#auth-message')!;
const authTitle = document.querySelector<HTMLElement>('#auth-title')!;
const authDescription = document.querySelector<HTMLElement>('#auth-description')!;
const authSubmit = document.querySelector<HTMLButtonElement>('#auth-submit')!;
const authToggle = document.querySelector<HTMLButtonElement>('#auth-toggle')!;
const authForgot = document.querySelector<HTMLButtonElement>('#auth-forgot')!;
const authUserLabel = document.querySelector<HTMLElement>('#auth-user')!;
const logoutButton = document.querySelector<HTMLButtonElement>('#logout-button')!;
const accountEmailButton = document.querySelector<HTMLButtonElement>('#account-email-button')!;
const recoveryRequestForm = document.querySelector<HTMLFormElement>('#recovery-request-form')!;
const recoveryEmail = document.querySelector<HTMLInputElement>('#recovery-email')!;
const recoveryRequestSubmit = document.querySelector<HTMLButtonElement>('#recovery-request-submit')!;
const recoveryResetPane = document.querySelector<HTMLElement>('#recovery-reset-pane')!;
const recoveryRequestPane = document.querySelector<HTMLElement>('#recovery-request-pane')!;
const recoveryVerifyPane = document.querySelector<HTMLElement>('#recovery-verify-pane')!;
const recoveryResetForm = document.querySelector<HTMLFormElement>('#recovery-reset-form')!;
const recoveryPassword = document.querySelector<HTMLInputElement>('#recovery-password')!;
const recoveryTokenInput = document.querySelector<HTMLInputElement>('#recovery-token')!;
const recoveryMessage = document.querySelector<HTMLElement>('#recovery-message')!;
const recoveryBack = document.querySelector<HTMLButtonElement>('#recovery-back')!;
const verificationForm = document.querySelector<HTMLFormElement>('#recovery-verify-form')!;
const verificationToken = document.querySelector<HTMLInputElement>('#verification-token')!;
const accountEmailForm = document.querySelector<HTMLFormElement>('#account-email-form')!;
const accountEmailInput = document.querySelector<HTMLInputElement>('#account-email')!;
const accountEmailStatus = document.querySelector<HTMLElement>('#account-email-status')!;
const accountEmailMessage = document.querySelector<HTMLElement>('#account-email-message')!;
const accountEmailSubmit = document.querySelector<HTMLButtonElement>('#account-email-submit')!;
const accountEmailResend = document.querySelector<HTMLButtonElement>('#account-email-resend')!;
const accountBack = document.querySelector<HTMLButtonElement>('#account-back')!;
let registering = false;
let activeUser: AuthUser | null = null;
const query = new URLSearchParams(window.location.search);
const resetToken = query.get('reset_token');
const emailVerificationToken = query.get('verify_token');

authToggle.addEventListener('click', () => {
  registering = !registering;
  authEmailGroup.hidden = !registering;
  authEmail.required = registering;
  authForgot.hidden = registering;
  authTitle.textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
  authDescription.textContent = registering
    ? 'Completa tus datos. Verifica el correo para habilitar la recuperación de contraseña.'
    : 'Ingresa con tu cuenta para continuar.';
  authSubmit.textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
  authToggle.textContent = registering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate';
  authPassword.autocomplete = registering ? 'new-password' : 'current-password';
  authMessage.textContent = '';
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';
  const isRegistering = registering;
  authSubmit.disabled = true;
  authToggle.disabled = true;
  try {
    const username = authUsername.value.trim();
    const password = authPassword.value;
    if (isRegistering) {
      const result = await AuthService.register(username, password, authEmail.value.trim());
      authPassword.value = '';
      showApplication(result.user);
      if (result.emailVerificationSent) {
        NotificationService.success('Cuenta creada. Revisa tu correo para verificarlo.');
      } else {
        NotificationService.error('Cuenta creada, pero no se pudo enviar el correo. Configura Gmail API y verifica desde Mi correo.');
      }
      return;
    }
    const result = await AuthService.login(username, password);
    authPassword.value = '';
    showApplication(result.user);
  } catch (error) {
    authMessage.textContent = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
  } finally {
    authSubmit.disabled = false;
    authToggle.disabled = false;
  }
});

authForgot.addEventListener('click', () => showRecovery('request'));

recoveryRequestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  recoveryMessage.textContent = '';
  recoveryRequestSubmit.disabled = true;
  try {
    const result = await AuthService.requestPasswordReset(recoveryEmail.value.trim());
    recoveryMessage.textContent = result.message;
  } catch (error) {
    recoveryMessage.textContent = error instanceof Error ? error.message : 'No se pudo solicitar el enlace.';
  } finally {
    recoveryRequestSubmit.disabled = false;
  }
});

recoveryResetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  recoveryMessage.textContent = '';
  const submit = recoveryResetForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  try {
    const result = await AuthService.resetPassword(recoveryTokenInput.value, recoveryPassword.value);
    recoveryMessage.textContent = result.message;
    recoveryPassword.value = '';
    recoveryResetPane.hidden = true;
    recoveryRequestPane.hidden = true;
    recoveryBack.hidden = false;
    authMessage.textContent = result.message;
    recoveryBack.textContent = 'Volver al inicio de sesión';
    history.replaceState(null, '', window.location.pathname);
  } catch (error) {
    recoveryMessage.textContent = error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.';
  } finally {
    submit.disabled = false;
  }
});

verificationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  recoveryMessage.textContent = '';
  const submit = verificationForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  try {
    const result = await AuthService.verifyEmail(verificationToken.value);
    recoveryMessage.textContent = result.message;
    verificationForm.hidden = true;
    history.replaceState(null, '', window.location.pathname);
  } catch (error) {
    recoveryMessage.textContent = error instanceof Error ? error.message : 'No se pudo verificar el correo.';
  } finally {
    submit.disabled = false;
  }
});

recoveryBack.addEventListener('click', async () => {
  recoveryScreen.hidden = true;
  recoveryMessage.textContent = '';
  history.replaceState(null, '', window.location.pathname);
  recoveryRequestForm.reset();
  recoveryPassword.value = '';
  const user = await AuthService.getSession().catch(() => null);
  if (user) {
    showApplication(user);
  } else {
    authScreen.hidden = false;
    app.hidden = true;
  }
});

accountEmailButton.addEventListener('click', async () => {
  accountEmailMessage.textContent = '';
  accountEmailButton.disabled = true;
  try {
    const user = await AuthService.getSession();
    if (!user) throw new Error('Tu sesión venció. Inicia sesión nuevamente.');
    activeUser = user;
    accountEmailInput.value = user.correo_electronico || '';
    accountEmailStatus.textContent = user.correo_verificado
      ? 'Correo verificado.'
      : user.correo_electronico
        ? 'Pendiente de verificación; revisa tu bandeja o reenvía el enlace.'
        : 'Aún no has configurado un correo de recuperación.';
    accountEmailResend.hidden = !user.correo_electronico || user.correo_verificado;
    app.hidden = true;
    accountScreen.hidden = false;
  } catch (error) {
    NotificationService.error(error instanceof Error ? error.message : 'No se pudo cargar la cuenta.');
  } finally {
    accountEmailButton.disabled = false;
  }
});

accountEmailForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  accountEmailMessage.textContent = '';
  accountEmailSubmit.disabled = true;
  try {
    const result = await AuthService.updateRecoveryEmail(accountEmailInput.value.trim());
    accountEmailMessage.textContent = result.message;
    accountEmailStatus.textContent = 'Pendiente de verificación; revisa tu bandeja de entrada.';
    accountEmailResend.hidden = false;
    if (activeUser) {
      activeUser.correo_electronico = accountEmailInput.value.trim().toLowerCase();
      activeUser.correo_verificado = false;
    }
  } catch (error) {
    accountEmailMessage.textContent = error instanceof Error ? error.message : 'No se pudo guardar el correo.';
  } finally {
    accountEmailSubmit.disabled = false;
  }
});

accountEmailResend.addEventListener('click', async () => {
  accountEmailMessage.textContent = '';
  accountEmailResend.disabled = true;
  try {
    const result = await AuthService.resendEmailVerification();
    accountEmailMessage.textContent = result.message;
  } catch (error) {
    accountEmailMessage.textContent = error instanceof Error ? error.message : 'No se pudo reenviar la verificación.';
  } finally {
    accountEmailResend.disabled = false;
  }
});

accountBack.addEventListener('click', () => {
  accountScreen.hidden = true;
  app.hidden = false;
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await AuthService.logout();
    app.hidden = true;
    authScreen.hidden = false;
    accountScreen.hidden = true;
    activeUser = null;
    authEmail.value = '';
    authPassword.value = '';
    authMessage.textContent = '';
  } catch (error) {
    NotificationService.error(error instanceof Error ? error.message : 'No se pudo cerrar sesión.');
  } finally {
    logoutButton.disabled = false;
  }
});

if (resetToken || emailVerificationToken) {
  authScreen.hidden = true;
  recoveryScreen.hidden = false;
  if (resetToken) {
    showRecovery('reset', resetToken);
  } else if (emailVerificationToken) {
    showRecovery('verify', emailVerificationToken);
  }
} else {
  void AuthService.getSession()
    .then(user => {
      if (user) showApplication(user);
    })
    .catch(error => {
      authMessage.textContent = error instanceof Error
        ? error.message
        : 'No se pudo conectar con el servidor.';
    });
}

function showApplication(user: AuthUser): void {
  activeUser = user;
  authUserLabel.textContent = user.nombre_usuario;
  authScreen.hidden = true;
  recoveryScreen.hidden = true;
  accountScreen.hidden = true;
  app.hidden = false;
  if (applicationInitialized) return;
  applicationInitialized = true;
  initializeApplication();
}

function showRecovery(mode: 'request' | 'reset' | 'verify', token = ''): void {
  authScreen.hidden = true;
  accountScreen.hidden = true;
  app.hidden = true;
  recoveryScreen.hidden = false;
  recoveryMessage.textContent = '';
  recoveryRequestPane.hidden = mode !== 'request';
  recoveryResetPane.hidden = mode !== 'reset';
  recoveryVerifyPane.hidden = mode !== 'verify';
  recoveryBack.hidden = false;
  if (mode === 'reset') recoveryTokenInput.value = token;
  if (mode === 'verify') verificationToken.value = token;
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
