// Vice City Cover Studio — the cover renderer.
//
// drawCover(canvas, state) paints the multi-panel poster: every panel fills with its
// own photo (cover-fit, per-panel zoom and pan), a neon sunset grade, thin white
// gutters, and the kicker + caption lettered across the foot in Anton. Nothing here
// reads the network: photos are the person's own files or the bundled samples.

/** The three export sizes, in pixels. */
export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  tall: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

/** Multi-panel layouts, each panel a fraction of the canvas. */
export const LAYOUTS = {
  poster: {
    name: 'Poster',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.62 },
      { x: 0, y: 0.62, w: 0.34, h: 0.38 },
      { x: 0.34, y: 0.62, w: 0.33, h: 0.38 },
      { x: 0.67, y: 0.62, w: 0.33, h: 0.38 },
    ],
  },
  duo: {
    name: 'Duo',
    panels: [
      { x: 0, y: 0, w: 0.6, h: 1 },
      { x: 0.6, y: 0, w: 0.4, h: 0.5 },
      { x: 0.6, y: 0.5, w: 0.4, h: 0.5 },
    ],
  },
  trio: {
    name: 'Trio',
    panels: [
      { x: 0, y: 0, w: 0.34, h: 1 },
      { x: 0.34, y: 0, w: 0.33, h: 1 },
      { x: 0.67, y: 0, w: 0.33, h: 1 },
    ],
  },
};

/** Neon colour grades: two sky stops, a deep shadow colour, and a glow tint. */
export const GRADES = {
  sunset: { name: 'Sunset', sky: ['#ff2d78', '#ff7a18'], deep: '#4d1160', glow: '#ff2d78' },
  neon: { name: 'Neon', sky: ['#00e5ff', '#ff2d92'], deep: '#160a4d', glow: '#00e5ff' },
  gold: { name: 'Gold', sky: ['#ffb700', '#ff4d00'], deep: '#4d0b1b', glow: '#ffb700' },
};

/** Turns a #rrggbb colour into an rgba() string at the given alpha. */
export function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** The panel rectangles of a layout, in pixels, with gutters cut between them. */
export function layoutPanels(layout, w, h) {
  const gap = Math.max(4, Math.round(w * 0.006));
  return LAYOUTS[layout].panels.map((p) => ({
    x: p.x * w + gap / 2,
    y: p.y * h + gap / 2,
    w: p.w * w - gap,
    h: p.h * h - gap,
  }));
}

/** Draws one photo into a panel: cover-fit, then the panel's zoom and pan. */
function drawPhoto(ctx, img, rect, zoom, dx, dy) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  // Clamp the pan so the photo never leaves a gap at the panel's edge.
  const maxDx = Math.max(0, (pw - rect.w) / 2);
  const maxDy = Math.max(0, (ph - rect.h) / 2);
  const ox = Math.max(-maxDx, Math.min(maxDx, dx * rect.w));
  const oy = Math.max(-maxDy, Math.min(maxDy, dy * rect.h));
  ctx.drawImage(img, rect.x + (rect.w - pw) / 2 + ox, rect.y + (rect.h - ph) / 2 + oy, pw, ph);
}

/** The neon grade over one panel: warm wash, diagonal punch, vignette. */
function gradePanel(ctx, rect, grade) {
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  wash.addColorStop(0, hexA(grade.deep, 0));
  wash.addColorStop(0.55, hexA(grade.deep, 0.12));
  wash.addColorStop(1, hexA(grade.deep, 0.55));
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.3;
  const punch = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  punch.addColorStop(0, grade.sky[0]);
  punch.addColorStop(1, grade.sky[1]);
  ctx.fillStyle = punch;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  const vig = ctx.createRadialGradient(
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.35,
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(8, 2, 16, 0)');
  vig.addColorStop(1, 'rgba(8, 2, 16, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** Greedy word wrap of `text` to at most `maxWidth`, at the current font. */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** Letters the kicker and the caption across the foot of the cover. */
function drawCaption(ctx, w, h, state) {
  const grade = GRADES[state.grade];
  const bandTop = h * 0.82;
  const scrim = ctx.createLinearGradient(0, bandTop, 0, h);
  scrim.addColorStop(0, 'rgba(8, 2, 16, 0)');
  scrim.addColorStop(0.45, 'rgba(8, 2, 16, 0.55)');
  scrim.addColorStop(1, 'rgba(8, 2, 16, 0.85)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandTop, w, h - bandTop);

  const cx = w / 2;
  const kicker = (state.kicker || '').trim().toUpperCase();
  const kickerSize = Math.max(14, h * 0.024);
  const kickerY = bandTop + h * 0.028;
  if (kicker) {
    ctx.font = `${kickerSize}px Anton, "Arial Black", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(kickerSize * 0.42)}px`; } catch { /* older canvas */ }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = grade.sky[0];
    ctx.fillText(kicker, cx, kickerY);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }

  const text = (state.caption || '').trim().toUpperCase();
  if (!text) return;
  // Condense the caps sideways, the way poster lettering does.
  ctx.save();
  ctx.translate(cx, 0);
  ctx.scale(0.86, 1);
  ctx.translate(-cx, 0);
  const maxWidth = (w * 0.92) / 0.86;
  const blockTop = kickerY + h * 0.02;
  const blockBottom = h * 0.965;
  let size = h * 0.105;
  let lines = [];
  while (size > 18) {
    ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
    lines = wrapText(ctx, text, maxWidth);
    const blockH = lines.length * size * 0.98;
    if (lines.length <= 2 && blockTop + blockH <= blockBottom) break;
    size -= 4;
  }
  ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
  lines = wrapText(ctx, text, maxWidth);
  const lineH = size * 0.98;
  const firstBaseline = blockTop + size * 0.92;
  const fill = ctx.createLinearGradient(0, blockTop, 0, firstBaseline + (lines.length - 1) * lineH);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(1, '#ffe9a8');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#160a24';
  ctx.lineWidth = Math.max(3, size * 0.09);
  ctx.shadowColor = hexA(grade.glow, 0.85);
  ctx.shadowBlur = size * 0.14;
  ctx.shadowOffsetY = size * 0.02;
  lines.forEach((line, i) => {
    const y = firstBaseline + i * lineH;
    ctx.strokeText(line, cx, y);
    ctx.fillStyle = fill;
    ctx.fillText(line, cx, y);
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // A short neon bar under the title.
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const barW = Math.min(widest * 0.45, maxWidth * 0.4);
  const barY = firstBaseline + (lines.length - 1) * lineH + size * 0.22;
  if (barY + size * 0.05 < h * 0.99) {
    ctx.fillStyle = grade.sky[0];
    ctx.fillRect(cx - barW / 2, barY, barW, Math.max(3, size * 0.05));
  }
  ctx.restore();
}

/**
 * Paints the whole cover onto `canvas` from `state`:
 * { layout, grade, kicker, caption, panels: [{ img, zoom, dx, dy }] }.
 * With opts.selected set, the chosen panel gets a dashed outline (preview only).
 */
export function drawCover(canvas, state, opts = {}) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade];
  ctx.fillStyle = '#12061f';
  ctx.fillRect(0, 0, w, h);
  const rects = layoutPanels(state.layout, w, h);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || {};
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (panel.img) {
      drawPhoto(ctx, panel.img, rect, panel.zoom ?? 1, panel.dx ?? 0, panel.dy ?? 0);
    } else {
      const sky = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      sky.addColorStop(0, grade.sky[0]);
      sky.addColorStop(1, grade.deep);
      ctx.fillStyle = sky;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.font = `${Math.max(14, rect.h * 0.07)}px Anton, "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    gradePanel(ctx, rect, grade);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(2, w * 0.002);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (opts.selected === i) {
      ctx.save();
      ctx.setLineDash([Math.max(8, w * 0.012), Math.max(6, w * 0.008)]);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = Math.max(3, w * 0.004);
      ctx.strokeRect(rect.x - 4, rect.y - 4, rect.w + 8, rect.h + 8);
      ctx.restore();
    }
  });
  drawCaption(ctx, w, h, state);
}

/** Renders `state` at an export size and resolves with the PNG blob. */
export function exportCoverPng(state, sizeKey) {
  const { w, h } = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state);
  return new Promise((resolve) => off.toBlob(resolve, 'image/png'));
}
