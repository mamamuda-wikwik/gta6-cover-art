// Vice City Cover Studio — wires the editor: photos, panels, layout, grade, words
// and export. A `?shot=` query sets up a fixed scene for a screenshot instead
// (./shots.js). Photos are read on the person's own machine, never uploaded.

import { SIZES, LAYOUTS, GRADES, layoutPanels, drawCover, exportCoverPng } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const kickerInput = document.getElementById('kicker');
const statusEl = document.getElementById('status');
const panelName = document.getElementById('panel-name');
const zoomInput = document.getElementById('zoom');
const panXInput = document.getElementById('pan-x');
const panYInput = document.getElementById('pan-y');

/** The two upload slots (null until the person picks a file) and the samples. */
const photos = { a: null, b: null, pier: null, boulevard: null };

/** One entry per panel: which photo it shows, and its crop (zoom and pan). */
const state = {
  layout: 'poster',
  grade: 'sunset',
  size: 'square',
  kicker: 'VICE CITY',
  caption: 'Sunset Heist',
  selected: 0,
  panels: [
    { src: 'boulevard', zoom: 1, dx: 0, dy: 0.28 },
    { src: 'pier', zoom: 1.1, dx: 0, dy: 0 },
    { src: 'boulevard', zoom: 1, dx: 0, dy: 0.1 },
    { src: 'pier', zoom: 1.1, dx: 0, dy: 0 },
  ],
};

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** The drawable image a panel source key names, or null. */
function resolvePhoto(src) {
  return photos[src] ?? null;
}

/** The render state: the same shape, with each panel's image resolved. */
function renderState() {
  return {
    ...state,
    panels: state.panels.map((p) => ({ ...p, img: resolvePhoto(p.src) })),
  };
}

function redraw() {
  drawCover(canvas, renderState(), { selected: state.selected });
}

/** Keeps the panel controls showing the selected panel's crop. */
function syncPanelControls() {
  const p = state.panels[state.selected];
  panelName.textContent = `Panel ${state.selected + 1} of ${state.panels.length}`;
  zoomInput.value = p.zoom;
  panXInput.value = p.dx;
  panYInput.value = p.dy;
  document.querySelectorAll('[data-panel-src]').forEach((b) => {
    b.classList.toggle('active', b.dataset.panelSrc === p.src);
  });
  document.querySelectorAll('[data-panel]').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.panel) === state.selected);
  });
}

function selectPanel(i) {
  state.selected = Math.max(0, Math.min(state.panels.length - 1, i));
  syncPanelControls();
  redraw();
}

/** Rebuilds the panel list when the layout changes, keeping the photos. */
function applyLayout(name) {
  state.layout = name;
  const count = LAYOUTS[name].panels.length;
  const kept = state.panels.slice(0, count);
  const fill = [
    { src: 'boulevard', zoom: 1, dx: 0, dy: 0.28 },
    { src: 'pier', zoom: 1.1, dx: 0, dy: 0 },
    { src: 'boulevard', zoom: 1, dx: 0, dy: 0.1 },
    { src: 'pier', zoom: 1.1, dx: 0, dy: 0 },
  ];
  while (kept.length < count) {
    kept.push({ ...fill[kept.length % fill.length] });
  }
  state.panels = kept;
  state.selected = 0;
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === name);
  });
  buildPanelButtons();
  syncPanelControls();
  redraw();
}

/** The row of Panel 1..N buttons, rebuilt when the layout changes. */
function buildPanelButtons() {
  const row = document.getElementById('panel-pick');
  row.innerHTML = '';
  state.panels.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.panel = String(i);
    b.textContent = `Panel ${i + 1}`;
    b.addEventListener('click', () => selectPanel(i));
    row.appendChild(b);
  });
}

/** Fills every panel with the same photo source. */
function fillAll(src) {
  state.panels.forEach((p) => { p.src = src; });
  syncPanelControls();
  redraw();
}

/** Points the selected panel at a photo source. */
function setPanelSource(src) {
  state.panels[state.selected].src = src;
  syncPanelControls();
  redraw();
}

/** Sizes the preview canvas to the chosen export size, then redraws. */
function applySize(key) {
  state.size = key;
  const { w, h } = SIZES[key];
  canvas.width = w;
  canvas.height = h;
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === key);
  });
  redraw();
}

function applyGrade(name) {
  state.grade = name;
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === name);
  });
  redraw();
}

/** Downloads a PNG blob as a file. */
function downloadPng(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function exportSize(key) {
  const blob = await exportCoverPng(renderState(), key);
  const { w, h } = SIZES[key];
  downloadPng(blob, `vice-city-cover-${w}x${h}.png`);
  statusEl.textContent = `Saved vice-city-cover-${w}x${h}.png`;
}

/** Exports all three post sizes, one after another. */
async function exportAll() {
  for (const key of Object.keys(SIZES)) {
    await exportSize(key);
    await new Promise((r) => setTimeout(r, 400));
  }
  statusEl.textContent = 'Saved all three sizes: 1080x1080, 1080x1350, 1920x1080.';
}

/** Reads a picked file into an upload slot and redraws. */
async function pickPhoto(slot, file) {
  if (!file) return;
  photos[slot] = await loadImage(URL.createObjectURL(file));
  redraw();
  statusEl.textContent = `Photo ${slot.toUpperCase()} loaded — pick a panel and place it.`;
}

document.getElementById('photo-a').addEventListener('change', (e) => pickPhoto('a', e.target.files[0]));
document.getElementById('photo-b').addEventListener('change', (e) => pickPhoto('b', e.target.files[0]));
document.getElementById('fill-all').addEventListener('change', (e) => {
  if (e.target.value) fillAll(e.target.value);
});
document.querySelectorAll('[data-panel-src]').forEach((b) => {
  b.addEventListener('click', () => setPanelSource(b.dataset.panelSrc));
});
document.querySelectorAll('[data-layout]').forEach((b) => {
  b.addEventListener('click', () => applyLayout(b.dataset.layout));
});
document.querySelectorAll('[data-grade]').forEach((b) => {
  b.addEventListener('click', () => applyGrade(b.dataset.grade));
});
document.querySelectorAll('[data-size]').forEach((b) => {
  b.addEventListener('click', () => applySize(b.dataset.size));
});
zoomInput.addEventListener('input', () => {
  state.panels[state.selected].zoom = Number(zoomInput.value);
  redraw();
});
panXInput.addEventListener('input', () => {
  state.panels[state.selected].dx = Number(panXInput.value);
  redraw();
});
panYInput.addEventListener('input', () => {
  state.panels[state.selected].dy = Number(panYInput.value);
  redraw();
});
captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
kickerInput.addEventListener('input', () => { state.kicker = kickerInput.value; redraw(); });
document.getElementById('export').addEventListener('click', () => exportSize(state.size));
document.getElementById('export-all').addEventListener('click', exportAll);

/** Dragging the preview pans the panel under the pointer. */
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * canvas.width;
  const y = ((e.clientY - r.top) / r.height) * canvas.height;
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const hit = rects.findIndex((rc) => x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h);
  if (hit === -1) return;
  selectPanel(hit);
  drag = { panel: hit, x, y, dx: state.panels[hit].dx, dy: state.panels[hit].dy, rect: rects[hit] };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * canvas.width;
  const y = ((e.clientY - r.top) / r.height) * canvas.height;
  const p = state.panels[drag.panel];
  p.dx = drag.dx + (x - drag.x) / drag.rect.w;
  p.dy = drag.dy + (y - drag.y) / drag.rect.h;
  syncPanelControls();
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });

/** Loads the bundled samples, then draws the first cover. */
async function boot() {
  const [pier, boulevard] = await Promise.all([
    loadImage('samples/pier.jpg'),
    loadImage('samples/boulevard.jpg'),
  ]);
  photos.pier = pier;
  photos.boulevard = boulevard;
  try { await document.fonts.load('100px Anton'); } catch { /* system font fallback */ }
  buildPanelButtons();
  syncPanelControls();
  applySize('square');
  document.fonts.ready.then(redraw);
}

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    boot,
    photos,
    state,
    applyLayout,
    applyGrade,
    applySize,
    setPanelSource,
    fillAll,
    selectPanel,
    redraw,
    syncPanelControls,
    buildPanelButtons,
  });
} else {
  boot();
}
