// Fixed scenes for screenshots: ?shot=editor shows the page with a sample photo;
// ?shot=cover shows the cover alone. `photo` picks the sample (samples/<photo>.jpg),
// `caption` the words, `kicker` the small line above them, `layout` the panel layout,
// `grade` the neon grade and `size` the export size (square, tall or wide).
// window.__shotReady is set once the cover is painted.

/** Sets up one screenshot scene, then flags the page ready to capture. */
export async function runShot(shot, query, app) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await app.boot();
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const kicker = query.get('kicker') ?? 'VICE CITY';
  const layout = query.get('layout') ?? 'poster';
  const grade = query.get('grade') ?? 'sunset';
  const size = query.get('size') ?? 'square';
  app.applyLayout(layout);
  app.applyGrade(grade);
  app.applySize(size);
  app.fillAll(photo);
  app.state.kicker = kicker;
  app.state.caption = caption;
  const kickerInput = document.getElementById('kicker');
  const captionInput = document.getElementById('caption');
  if (kickerInput) kickerInput.value = kicker;
  if (captionInput) captionInput.value = caption;
  app.selectPanel(0);
  // A cover shot shows the art alone: no editor selection outline on any panel.
  if (shot === 'cover') app.state.selected = -1;
  try { await document.fonts.load('100px Anton'); } catch { /* system font fallback */ }
  app.redraw();
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
