// ─── Bar chart rendered with Canvas 2D API ────────────────────────────────────
//
// Why Canvas instead of an SVG or a library like Chart.js?
// The Content-Security-Policy in index.html is set to `script-src 'self'`,
// which blocks loading scripts from CDNs.  Canvas is built into every browser
// and requires no external files — it just works within the CSP.

/**
 * Draw a bar chart on the given <canvas> element.
 *
 * @param {HTMLCanvasElement} canvas  - The canvas to draw on.
 * @param {Array<{label:string, minutes:number}>} buckets
 *        - Data points. Each has a short label and a value in minutes.
 */
function drawBarChart(canvas, buckets) {
  // ── 1. Match canvas pixel buffer to its CSS display size ─────────────────
  // On HiDPI / Retina screens the device has 2× (or more) physical pixels per
  // CSS pixel.  If we don't account for this the chart looks blurry.
  const dpr           = window.devicePixelRatio || 1;
  const displayWidth  = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  canvas.width  = displayWidth  * dpr;
  canvas.height = displayHeight * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr); // all drawing coordinates now use CSS pixels

  // ── 2. Layout constants ────────────────────────────────────────────────────
  const pad = { top: 20, right: 16, bottom: 40, left: 52 };
  const chartW = displayWidth  - pad.left - pad.right;
  const chartH = displayHeight - pad.top  - pad.bottom;

  // Colours pulled from the app's CSS variables (matching the dark theme)
  const BG_COLOR    = '#1a1a2e';
  const AXIS_COLOR  = '#0f3460';
  const TEXT_COLOR  = '#8892a4';
  const BAR_COLOR   = '#e94560';
  const FONT        = '11px system-ui, sans-serif';

  // ── 3. Background ──────────────────────────────────────────────────────────
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, displayWidth, displayHeight);

  // ── 4. Determine Y axis scale ─────────────────────────────────────────────
  const maxMinutes = Math.max(...buckets.map(b => b.minutes), 30); // min range 30 min

  // Pick nice round tick values
  const ticks = [0, Math.round(maxMinutes / 2), maxMinutes];

  // ── 5. Draw Y axis ticks + grid lines ─────────────────────────────────────
  ctx.font      = FONT;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'right';

  ticks.forEach(tick => {
    const y = pad.top + chartH - (tick / maxMinutes) * chartH;

    // Tick label: show as "Xh" if ≥60 min, else "Xm"
    const label = tick >= 60 ? `${(tick / 60).toFixed(1)}h` : `${tick}m`;
    ctx.fillText(label, pad.left - 8, y + 4);

    // Subtle grid line
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // ── 6. Draw X axis line ───────────────────────────────────────────────────
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + chartH);
  ctx.lineTo(pad.left + chartW, pad.top + chartH);
  ctx.stroke();

  // ── 7. Draw bars ──────────────────────────────────────────────────────────
  if (buckets.length === 0) return;

  const slotW  = chartW / buckets.length;
  const barW   = Math.max(slotW * 0.55, 4);
  const radius = Math.min(4, barW / 2);

  ctx.fillStyle = BAR_COLOR;

  buckets.forEach((bucket, i) => {
    const barH = (bucket.minutes / maxMinutes) * chartH;
    const x    = pad.left + i * slotW + (slotW - barW) / 2;
    const y    = pad.top  + chartH - barH;

    if (barH < 1) return; // skip invisible bars

    // Draw bar with rounded top corners
    roundedTopRect(ctx, x, y, barW, barH, radius);
    ctx.fill();

    // X axis label below bar
    ctx.fillStyle   = TEXT_COLOR;
    ctx.font        = FONT;
    ctx.textAlign   = 'center';
    ctx.fillText(bucket.label, x + barW / 2, pad.top + chartH + 16);
    ctx.fillStyle = BAR_COLOR; // restore for next bar
  });
}

/**
 * Draw a rectangle with rounded top-left and top-right corners only.
 * Used to give bars a modern, pill-top look.
 */
function roundedTopRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x,     y + h);
  ctx.lineTo(x,     y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
