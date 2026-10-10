import { DatabaseService } from '../services/storage.service';
import { ModalManager } from './modals';
import { Venta } from '../types';
import { NotificationService } from '../services/notification.service';
import { escapeHtml } from './html';
import { renderDataError } from './data-error';

export class SalesView {
  private static tableBody = document.getElementById('sales-table-body') as HTMLElement;
  private static grandTotal = document.getElementById('sales-grand-total') as HTMLElement;

  static init(): void {
    // Inicialización si se requieren eventos adicionales
  }

  static async render(): Promise<void> {
    let ventas: Venta[];
    try {
      ventas = await DatabaseService.getVentas();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar las ventas.';
      renderDataError(this.tableBody, message, () => void this.render(), 4);
      return;
    }
    const totalAcumulado = ventas.reduce((sum, v) => sum + v.total, 0);
    this.grandTotal.textContent = `$${totalAcumulado.toFixed(2)}`;

    if (ventas.length === 0) {
      this.tableBody.innerHTML = `
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

    this.tableBody.innerHTML = '';
    ventas.forEach(v => {
      const fechaHora = new Date(v.fecha_hora).toLocaleString('es-SV');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">Ticket #${v.id_venta}</td>
        <td>${escapeHtml(fechaHora)}</td>
        <td class="bold" style="color: var(--primary);">$${v.total.toFixed(2)}</td>
        <td class="text-right">
          <button class="btn btn-secondary btn-sm" data-view-ticket="${v.id_venta}">Ver Desglose</button>
        </td>
      `;

      tr.querySelector(`[data-view-ticket="${v.id_venta}"]`)?.addEventListener('click', () => {
        void this.openTicketModal(v);
      });

      this.tableBody.appendChild(tr);
    });
  }

  private static async openTicketModal(venta: Venta): Promise<void> {
    let data: Awaited<ReturnType<typeof DatabaseService.getVentaDetalle>>;
    try {
      data = await DatabaseService.getVentaDetalle(venta.id_venta);
    } catch (err) {
      NotificationService.error(err instanceof Error ? err.message : 'No se pudo cargar el detalle de la venta.');
      return;
    }

    (document.getElementById('modal-ticket-title') as HTMLElement).textContent = `Ticket #${venta.id_venta}`;
    (document.getElementById('ticket-date') as HTMLElement).textContent =
      new Date(venta.fecha_hora).toLocaleString('es-SV');
    (document.getElementById('ticket-total-display') as HTMLElement).textContent = `$${venta.total.toFixed(2)}`;

    const body = document.getElementById('ticket-items-body') as HTMLElement;
    body.innerHTML = '';

    data.detalles.forEach(d => {
      const unitPrice = d.subtotal / d.cantidad;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(d.nombre_producto || `Producto #${d.id_producto}`)}</td>
        <td>${d.cantidad}</td>
        <td>$${unitPrice.toFixed(2)}</td>
        <td class="text-right bold">$${d.subtotal.toFixed(2)}</td>
      `;
      body.appendChild(tr);
    });

    ModalManager.openSaleDetailModal();
  }
}
