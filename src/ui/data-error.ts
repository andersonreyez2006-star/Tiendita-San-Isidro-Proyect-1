export function renderDataError(
  target: HTMLElement,
  message: string,
  retry: () => void,
  columns?: number
): void {
  target.replaceChildren();

  const error = document.createElement('div');
  error.className = 'data-error';
  error.setAttribute('role', 'alert');

  const text = document.createElement('p');
  text.textContent = message;
  error.appendChild(text);

  const button = document.createElement('button');
  button.className = 'btn btn-secondary btn-sm';
  button.textContent = 'Reintentar';
  button.addEventListener('click', retry);
  error.appendChild(button);

  if (target instanceof HTMLTableSectionElement) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = columns || 1;
    cell.appendChild(error);
    row.appendChild(cell);
    target.appendChild(row);
    return;
  }

  target.appendChild(error);
}
