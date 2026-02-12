import { el } from '../utils/dom.js';

/**
 * Pure Canvas line chart (no external libraries).
 * @param {Object} props
 * @param {{ label: string, revenue: number, cost: number }[]} props.data
 * @param {string} [props.title]
 */
export function LineChartCanvas({ data, title }) {
  const container = el('div', { className: 'chart-container' });

  if (title) {
    container.appendChild(el('h3', { className: 'mb-sm' }, title));
  }

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 300;
  canvas.style.width = '100%';
  canvas.style.height = '300px';
  container.appendChild(canvas);

  // Draw after DOM attachment
  requestAnimationFrame(() => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    drawChart(ctx, rect.width, rect.height, data);
  });

  return container;
}

function drawChart(ctx, width, height, data) {
  if (!data || data.length === 0) {
    ctx.fillStyle = '#5f6672';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Brak danych do wyświetlenia', width / 2, height / 2);
    return;
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const revenues = data.map(d => d.revenue);
  const maxVal = Math.max(...revenues, 1);
  const minVal = 0;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Grid lines
  const gridLines = 5;
  ctx.strokeStyle = '#e8ecf1';
  ctx.lineWidth = 1;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = '#5f6672';
  ctx.textAlign = 'right';

  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    const val = maxVal - (maxVal / gridLines) * i;

    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    ctx.fillText(val.toFixed(0), padding.left - 8, y + 4);
  }

  // X axis labels
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5f6672';
  const step = Math.max(1, Math.floor(data.length / 15));
  for (let i = 0; i < data.length; i += step) {
    const x = padding.left + (chartW / (data.length - 1 || 1)) * i;
    ctx.fillText(data[i].label, x, height - padding.bottom + 20);
  }

  // Draw revenue line
  if (data.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    for (let i = 0; i < data.length; i++) {
      const x = padding.left + (chartW / (data.length - 1)) * i;
      const y = padding.top + chartH - (data[i].revenue / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill area under the line
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
    ctx.fill();

    // Draw dots
    ctx.fillStyle = '#2563eb';
    for (let i = 0; i < data.length; i++) {
      const x = padding.left + (chartW / (data.length - 1)) * i;
      const y = padding.top + chartH - (data[i].revenue / maxVal) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (data.length === 1) {
    const x = padding.left + chartW / 2;
    const y = padding.top + chartH - (data[0].revenue / maxVal) * chartH;
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Legend
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(padding.left, height - 12, 12, 3);
  ctx.fillStyle = '#5f6672';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Przychód', padding.left + 18, height - 8);
}

/**
 * Pure Canvas bar chart (no external libraries).
 * @param {Object} props
 * @param {{ label: string, revenue: number }[]} props.data
 * @param {string} [props.title]
 */
export function BarChartCanvas({ data, title }) {
  const container = el('div', { className: 'chart-container' });

  if (title) {
    container.appendChild(el('h3', { className: 'mb-sm' }, title));
  }

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 300;
  canvas.style.width = '100%';
  canvas.style.height = '300px';
  container.appendChild(canvas);

  requestAnimationFrame(() => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    drawBarChart(ctx, rect.width, rect.height, data);
  });

  return container;
}

function drawBarChart(ctx, width, height, data) {
  if (!data || data.length === 0) {
    ctx.fillStyle = '#5f6672';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Brak danych do wyświetlenia', width / 2, height / 2);
    return;
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const revenues = data.map(d => d.revenue);
  const maxVal = Math.max(...revenues, 1);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Grid lines
  const gridLines = 5;
  ctx.strokeStyle = '#e8ecf1';
  ctx.lineWidth = 1;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = '#5f6672';
  ctx.textAlign = 'right';

  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    const val = maxVal - (maxVal / gridLines) * i;

    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    ctx.fillText(val.toFixed(0), padding.left - 8, y + 4);
  }

  // Bar dimensions
  const barGap = 2;
  const totalBarWidth = chartW / data.length;
  const barWidth = Math.max(totalBarWidth - barGap * 2, 2);

  // Draw bars
  for (let i = 0; i < data.length; i++) {
    const x = padding.left + totalBarWidth * i + barGap;
    const barH = (data[i].revenue / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    // Bar fill with gradient effect
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(x, y, barWidth, barH);

    // Lighter top highlight
    ctx.fillStyle = 'rgba(59, 130, 246, 0.7)';
    ctx.fillRect(x, y, barWidth, Math.min(3, barH));
  }

  // X axis labels
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5f6672';
  ctx.font = '11px -apple-system, sans-serif';
  const step = Math.max(1, Math.floor(data.length / 15));
  for (let i = 0; i < data.length; i += step) {
    const x = padding.left + totalBarWidth * i + totalBarWidth / 2;
    ctx.fillText(data[i].label, x, height - padding.bottom + 20);
  }

  // Legend
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(padding.left, height - 12, 12, 10);
  ctx.fillStyle = '#5f6672';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Przychód dzienny', padding.left + 18, height - 4);
}
