/**
 * Servicio de notificaciones flotantes (Toast)
 */
export class NotificationService {
  private static container = document.getElementById('toast-container');

  static show(message: string, type: 'success' | 'error' = 'success', durationMs = 3500): void {
    if (!this.container) {
      this.container = document.getElementById('toast-container');
    }
    if (!this.container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, durationMs);
  }

  static success(message: string): void {
    this.show(message, 'success');
  }

  static error(message: string): void {
    this.show(message, 'error');
  }
}
