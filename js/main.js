/*
 * Copia Segura
 * Copyright (C) 2026 Fabio Britez
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * main.js - Flow orchestration.
 *
 * Five-step state machine: 1 Load · 2 Document · 3 Protect · 4 Mark · 5
 * Download. This module only coordinates: native-resolution safety lives in
 * editor.js, irreversibility in redact.js, and final-file hygiene in export.js.
 */


const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const editor = new Editor($('#canvas'));
const redactor = new Redactor();

const state = {
  step: 1,
  template: TEMPLATES[0],
  zones: [],           // proposed/manual zones not applied yet (master coords)
  appliedZones: [],    // zones already burned in, aligned with the redactor stack
  manualCount: 0,
  burnedCount: 0,   // zones burned into the current master
  drag: null,          // rectangle in progress {x0,y0,x1,y1} (master coords)
  corners: null,       // 4 framing points (master coords)
  activeCorner: -1,    // index of the corner being dragged
  grabOffset: null,    // finger-to-corner distance, so it does not jump on grab
  watermark: { recipient: '', purpose: '', date: '', code: null, opacity: 0.28 },
  codeRequest: 0,      // to discard hash computations that arrive late
  noZonesWarned: false,
  downloaded: false,   // do not nag on exit if the work is already saved
};

/* ================= navigation ================= */

function goToStep(n) {
  state.step = n;
  // The cover collapses once editing starts: the canvas needs the room.
  document.body.classList.toggle('working', n > 1);
  $$('.step').forEach((section) => {
    section.hidden = Number(section.dataset.step) !== n;
  });
  $$('#steps li').forEach((item, i) => {
    const step = i + 1;
    item.classList.toggle('active', step === n);
    item.classList.toggle('done', step < n);
    // aria-current tells the screen reader which step the user is on.
    if (step === n) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });

  // There is a single canvas and it travels to the active step, so the photo is
  // always ABOVE the controls instead of requiring a scroll to see it.
  const canvasArea = $('#canvasArea');
  const slot = document.querySelector('.step[data-step="' + n + '"] .canvas-slot');
  if (slot) {
    slot.appendChild(canvasArea);
    canvasArea.hidden = false;
  } else {
    canvasArea.hidden = true;
  }

  if (n === 2 && !state.corners) state.corners = editor.initialCorners();
  if (n === 3) {
    refreshGuide();
    refreshZoneList();
  }
  if (n === 4) recomputeCode();
  if (n === 5) refreshFinalPreview();

  if (n >= 2 && n <= 4) {
    editor.fitView();
    renderCurrent();
  }
}

/* ================= render ================= */

function watermarkText() {
  const w = state.watermark;
  return [w.recipient, w.purpose, w.date]
    .map((t) => t.trim())
    .filter(Boolean)
    .join(' · ');
}

function renderCurrent() {
  if (!editor.loaded) return;
  const guides = {};
  if (state.step === 2) {
    guides.corners = state.corners;
  } else if (state.step === 3) {
    guides.zones = state.zones;
    guides.dragRect = state.drag;
  } else if (state.step === 4) {
    const line1 = watermarkText();
    if (line1 || state.watermark.code) {
      guides.watermark = (ctx, width, height) =>
        drawWatermark(ctx, width, height, {
          line1,
          code: state.watermark.code,
          opacity: state.watermark.opacity,
        });
    }
  }
  editor.render(guides);
}

/* ================= step 1 · load ================= */

async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    notify('Elegí un archivo de imagen (JPG o PNG).');
    return;
  }
  try {
    await editor.loadFile(file);
  } catch (e) {
    notify('No se pudo leer esa imagen. Probá con otro archivo.');
    return;
  }
  resetEditing();
  goToStep(2);
}

function resetEditing() {
  state.zones = [];
  state.burnedCount = 0;
  state.appliedZones = [];
  state.noZonesWarned = false;
  state.downloaded = false;
  state.drag = null;
  state.corners = editor.initialCorners();
  redactor.clear();
  $('#btnUndo').disabled = true;
}

$('#fileInput').addEventListener('change', (e) => {
  loadFile(e.target.files[0]);
});

const dropZone = $('#uploadZone');
dropZone.addEventListener('click', () => $('#fileInput').click());
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    $('#fileInput').click();
  }
});
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  loadFile(e.dataTransfer.files[0]);
});

/* ================= step 2 · document ================= */

function buildTemplateList() {
  const list = $('#templateList');
  for (const t of TEMPLATES) {
    const label = document.createElement('label');
    label.className = 'template-card';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'template';
    radio.value = t.id;
    radio.checked = t.id === state.template.id;
    radio.addEventListener('change', () => {
      state.template = templateById(t.id);
      state.zones = []; // suggested again on entering Protect
    });
    const text = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = t.name;
    const detail = document.createElement('small');
    detail.textContent = t.description;
    text.appendChild(name);
    text.appendChild(detail);
    label.appendChild(radio);
    label.appendChild(text);
    list.appendChild(label);
  }
}

/*
 * Rotating or straightening warps the master, so zone coordinates and the undo
 * stack no longer match it and are discarded. `burnedCount` is not: those
 * pixels are still covered in the transformed image.
 */
function invalidateGeometry() {
  state.zones = [];
  state.appliedZones = [];
  state.corners = editor.initialCorners();
  redactor.clear();
  $('#btnUndo').disabled = true;
}

$('#btnRotate').addEventListener('click', () => {
  editor.rotate90();
  invalidateGeometry();
  renderCurrent();
});

$('#btnStraighten').addEventListener('click', () => {
  if (!state.corners) return;
  const button = $('#btnStraighten');
  button.disabled = true;
  button.textContent = 'Enderezando…';

  // One frame so the browser paints the pending state before the computation,
  // which blocks the thread for a few hundred ms on large photos.
  requestAnimationFrame(() => {
    setTimeout(() => {
      const ok = editor.applyCorners(state.corners);
      button.disabled = false;
      button.textContent = 'Enderezar y recortar';
      if (!ok) {
        notify(
          'No se pudo enderezar con esas esquinas. Fijate que formen un ' +
            'cuadrilátero sin lados cruzados y que no estén encimadas.'
        );
        return;
      }
      invalidateGeometry();
      // The image already IS the cropped document, so the handles go to the
      // four tips instead of floating inside.
      state.corners = editor.edgeCorners();
      renderCurrent();
    }, 0);
  });
});

$('#btnRestore').addEventListener('click', () => {
  // Unlike rotating, this restores the canvas from before any redaction, so
  // the burned pixels are genuinely gone.
  editor.restoreFraming();
  state.burnedCount = 0;
  invalidateGeometry();
  renderCurrent();
});

$('#btnChangeImage').addEventListener('click', resetAll);
$('#btnContinue2').addEventListener('click', () => goToStep(3));

/* ================= step 3 · protect ================= */

/*
 * Guidance on what to cover is text, not rectangles: seven DNI series with
 * different layouts circulate, and a misplaced rectangle that the user confirms
 * without looking is the worst possible failure of this tool.
 */
function refreshGuide() {
  // The single most important item stays ALWAYS visible; the rest goes in the
  // disclosure. Inside a closed <details> many people would never read it.
  $('#keyText').textContent = state.template.key;
  paintGuide($('#coverList'), state.template.hide);
  paintGuide($('#keepList'), state.template.keep);
}

function paintGuide(list, entries) {
  list.textContent = '';
  for (const entry of entries) {
    const item = document.createElement('li');
    if (entry.critical) item.className = 'critical';
    const title = document.createElement('strong');
    title.textContent = entry.title;
    const detail = document.createElement('span');
    detail.textContent = entry.detail;
    item.appendChild(title);
    item.appendChild(detail);
    list.appendChild(item);
  }
}


function updateCounter() {
  const marked = state.zones.filter((z) => z.active).length;
  const total = marked + state.burnedCount;
  const counter = $('#zoneCount');
  counter.textContent = total;
  counter.classList.toggle('zero', total === 0);
  $('#btnUndo').disabled = redactor.availableSteps === 0;
}

function refreshZoneList() {
  const list = $('#zoneList');
  list.textContent = '';
  if (!state.zones.length) {
    const empty = document.createElement('li');
    empty.className = 'zone-empty';
    empty.textContent =
      state.burnedCount > 0
        ? 'Listo, ya ocultaste ' + state.burnedCount +
          (state.burnedCount === 1 ? ' zona' : ' zonas') +
          '. Podés marcar más arrastrando sobre la foto.'
        : 'Todavía no marcaste ninguna zona. Arrastrá sobre la foto para marcar la primera.';
    list.appendChild(empty);
    updateCounter();
    return;
  }
  for (const zone of state.zones) {
    const item = document.createElement('li');
    item.className = 'zone-item';

    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = zone.active;
    box.addEventListener('change', () => {
      zone.active = box.checked;
      renderCurrent();
    });
    const name = document.createElement('span');
    name.textContent = zone.label;
    label.appendChild(box);
    label.appendChild(name);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.setAttribute('aria-label', 'Quitar ' + zone.label);
    remove.textContent = '✕';
    remove.addEventListener('click', () => {
      state.zones = state.zones.filter((z) => z.id !== zone.id);
      refreshZoneList();
      renderCurrent();
    });

    item.appendChild(label);
    item.appendChild(remove);
    list.appendChild(item);
  }
  updateCounter();
}

function fillMode() {
  const chosen = $$('input[name="fillMode"]').find((r) => r.checked);
  return chosen ? chosen.value : 'solid';
}

function applyRedaction() {
  const active = state.zones.filter((z) => z.active);
  if (!active.length) return false;
  redactor.apply(editor.master, active, fillMode());
  state.appliedZones.push(...active);
  state.burnedCount += active.length;
  state.zones = state.zones.filter((z) => !z.active);
  $('#btnUndo').disabled = false;
  refreshZoneList();
  renderCurrent();
  return true;
}

/*
 * Undo restores the last hidden zone and puts it back in the list as marked, so
 * it can be adjusted and applied again.
 */
$('#btnUndo').addEventListener('click', () => {
  if (redactor.undo(editor.master)) {
    state.burnedCount = Math.max(0, state.burnedCount - 1);
    const zone = state.appliedZones.pop();
    if (zone) {
      zone.active = true;
      state.zones.push(zone);
    }
  }
  refreshZoneList();
  renderCurrent();
});

$('#btnBack3').addEventListener('click', () => goToStep(2));
$('#btnContinue3').addEventListener('click', () => {
  // Safety belt: pending zones are burned in here, so nobody moves on believing
  // they covered something that was still only an outline.
  applyRedaction();

  // Without this warning, someone can walk the whole flow without hiding
  // anything and download the full document believing it is protected. It is
  // the most expensive mistake a user of this tool can make.
  if (state.burnedCount === 0 && !state.noZonesWarned) {
    state.noZonesWarned = true;
    notify(
      'Ojo: no ocultaste ningún dato todavía. Si continuás así, vas a descargar ' +
        'el documento tal como está. Tocá "Ocultar y continuar" de nuevo si es lo que querés.'
    );
    return;
  }
  goToStep(4);
});

/* ================= step 4 · mark ================= */

async function recomputeCode() {
  const line1 = watermarkText();
  const request = ++state.codeRequest;
  if (!line1) {
    state.watermark.code = null;
    $('#codeOutput').textContent = '-';
    renderCurrent();
    return;
  }
  const code = await copyCode(
    state.watermark.recipient.trim(),
    state.watermark.purpose.trim(),
    state.watermark.date.trim()
  );
  if (request !== state.codeRequest) return; // arrived late: something changed
  state.watermark.code = code;
  $('#codeOutput').textContent = code;
  renderCurrent();
}

function bindWatermarkField(selector, key) {
  $(selector).addEventListener('input', (e) => {
    state.watermark[key] = e.target.value;
    recomputeCode();
  });
}
bindWatermarkField('#fieldRecipient', 'recipient');
bindWatermarkField('#fieldPurpose', 'purpose');
bindWatermarkField('#fieldDate', 'date');

$('#rangeOpacity').addEventListener('input', (e) => {
  state.watermark.opacity = Number(e.target.value) / 100;
  renderCurrent();
});

$('#btnBack4').addEventListener('click', () => goToStep(3));
$('#btnContinue4').addEventListener('click', () => goToStep(5));

/* ================= step 5 · download ================= */

function finalOptions() {
  const line1 = watermarkText();
  const withWatermark = $('#checkWatermark').checked && line1;
  return {
    grayscale: $('#checkGrayscale').checked,
    watermark: withWatermark
      ? { line1, code: state.watermark.code, opacity: state.watermark.opacity }
      : null,
  };
}

function refreshFinalPreview() {
  const line1 = watermarkText();
  $('#checkWatermark').disabled = !line1;
  if (!line1) $('#checkWatermark').checked = false;
  $('#codeRow').hidden = !(line1 && state.watermark.code);
  $('#finalCode').textContent = state.watermark.code || '';

  const composed = composeFinal(editor.master, finalOptions());
  const finalView = $('#finalCanvas');
  const container = finalView.parentElement;
  const scale = Math.min(
    1,
    Math.max(200, container.clientWidth) / composed.width,
    Math.round(window.innerHeight * 0.55) / composed.height
  );
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.round(composed.width * scale);
  const cssHeight = Math.round(composed.height * scale);
  finalView.width = Math.round(cssWidth * dpr);
  finalView.height = Math.round(cssHeight * dpr);
  finalView.style.width = cssWidth + 'px';
  finalView.style.height = cssHeight + 'px';
  const ctx = finalView.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(composed, 0, 0, cssWidth, cssHeight);
  composed.width = 0; // release the preview composition buffer
}

$('#checkGrayscale').addEventListener('change', refreshFinalPreview);
$('#checkWatermark').addEventListener('change', refreshFinalPreview);

$('#btnDownload').addEventListener('click', async () => {
  const chosen = $$('input[name="format"]').find((r) => r.checked);
  const format = chosen ? chosen.value : 'png';
  const composed = composeFinal(editor.master, finalOptions());
  try {
    const name = await download(composed, format);
    state.downloaded = true;
    $('#downloadMsg').textContent =
      'Listo, se descargó como ' + name + '. Abrilo y revisalo antes de compartirlo.';
  } catch (e) {
    notify('No se pudo generar el archivo: ' + e.message);
  } finally {
    composed.width = 0;
  }
});

$('#btnBack5').addEventListener('click', () => goToStep(4));
$('#btnReset').addEventListener('click', resetAll);

/* ================= shared ================= */

function resetAll() {
  state.manualCount = 0;
  state.burnedCount = 0;
  editor.reset();
  redactor.clear();
  state.zones = [];
  state.appliedZones = [];
  state.drag = null;
  state.corners = null;
  state.activeCorner = -1;
  state.watermark = { recipient: '', purpose: '', date: todayDate(), code: null, opacity: 0.28 };
  state.noZonesWarned = false;
  state.downloaded = false;
  $('#fileInput').value = '';
  $('#fieldRecipient').value = '';
  $('#fieldPurpose').value = '';
  $('#fieldDate').value = todayDate();
  $('#codeOutput').textContent = '-';
  $('#downloadMsg').textContent = '';
  goToStep(1);
}

/*
 * Floating notice. A fixed toast rather than a banner at the top of the page:
 * most of the interaction happens scrolled down, where a top banner would land
 * off screen.
 */
function notify(message) {
  const notice = $('#notice');
  notice.textContent = '';
  const text = document.createElement('span');
  text.textContent = message;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'notice-close';
  close.setAttribute('aria-label', 'Cerrar aviso');
  close.textContent = '✕';
  close.addEventListener('click', () => {
    notice.hidden = true;
  });
  notice.appendChild(text);
  notice.appendChild(close);
  notice.hidden = false;
  clearTimeout(notify._timer);
  // 7 s: the safety messages are long and must be readable to the end.
  notify._timer = setTimeout(() => {
    notice.hidden = true;
  }, 7000);
}

function todayDate() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm + '/' + today.getFullYear();
}

/* ---------- pointer interaction on the view ----------
 *
 * Two deliberately distinct behaviours, one per step:
 *   Step 2 (framing) -> drag the four corners of the quadrilateral.
 *   Step 3 (hiding)  -> drag to draw new rectangles.
 */

const viewCanvas = $('#canvas');

/*
 * Grab radius of a handle, in screen pixels. Noticeably larger than the drawn
 * circle (13 px) because nobody hits the exact vertex, least of all with a
 * finger, which also covers the point it is aiming at.
 */
const GRAB_RADIUS =
  window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 48 : 34;

function nearestCorner(event) {
  if (!state.corners) return -1;
  const box = viewCanvas.getBoundingClientRect();
  const px = event.clientX - box.left;
  const py = event.clientY - box.top;

  // Never grab two corners at once: the radius is capped below half the shortest
  // side, so even a small quadrilateral stays unambiguous.
  let shortestSide = Infinity;
  for (let i = 0; i < 4; i++) {
    const a = state.corners[i];
    const b = state.corners[(i + 1) % 4];
    shortestSide = Math.min(shortestSide, Math.hypot(b.x - a.x, b.y - a.y) * editor.scale);
  }
  const radius = Math.min(GRAB_RADIUS, Math.max(16, shortestSide * 0.45));

  let best = -1;
  let bestDistance = radius;
  state.corners.forEach((q, i) => {
    const d = Math.hypot(q.x * editor.scale - px, q.y * editor.scale - py);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best;
}

viewCanvas.addEventListener('pointerdown', (e) => {
  if (!editor.loaded || (state.step !== 2 && state.step !== 3)) return;
  e.preventDefault();
  viewCanvas.setPointerCapture(e.pointerId);

  if (state.step === 2) {
    state.activeCorner = nearestCorner(e);
    if (state.activeCorner >= 0) {
      // Keeping the finger-to-corner offset avoids a jump on grab and, more
      // importantly, leaves the corner VISIBLE while it is moved: under the
      // finger it cannot be aligned with anything.
      const p = editor.masterPoint(e);
      const q = state.corners[state.activeCorner];
      state.grabOffset = { x: q.x - p.x, y: q.y - p.y };
    }
    // Grabbing nothing does nothing, silently: the instruction is already on
    // screen and a red banner on every missed tap annoys more than it helps.
    return;
  }

  const p = editor.masterPoint(e);
  state.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  renderCurrent();
});

viewCanvas.addEventListener('pointermove', (e) => {
  if (state.step === 2) {
    if (state.activeCorner < 0) return;
    const p = editor.masterPoint(e);
    const d = state.grabOffset || { x: 0, y: 0 };
    state.corners[state.activeCorner] = editor.clampToMaster({
      x: p.x + d.x,
      y: p.y + d.y,
    });
    renderCurrent();
    return;
  }

  if (!state.drag) return;
  const p = editor.masterPoint(e);
  state.drag.x1 = p.x;
  state.drag.y1 = p.y;
  renderCurrent();
});

viewCanvas.addEventListener('pointerup', () => {
  if (state.step === 2) {
    state.activeCorner = -1;
    state.grabOffset = null;
    return;
  }

  if (!state.drag) return;
  const a = state.drag;
  const rect = {
    x: Math.min(a.x0, a.x1),
    y: Math.min(a.y0, a.y1),
    width: Math.abs(a.x1 - a.x0),
    height: Math.abs(a.y1 - a.y0),
  };
  state.drag = null;

  if (rect.width >= 8 && rect.height >= 8) {
    state.manualCount++;
    state.zones.push({
      id: state.manualCount,
      label: 'Zona ' + state.manualCount,
      level: 'manual',
      source: 'manual',
      active: true,
      rect,
    });
    refreshZoneList();
  }
  renderCurrent();
});

viewCanvas.addEventListener('pointercancel', () => {
  state.drag = null;
  state.activeCorner = -1;
  state.grabOffset = null;
  renderCurrent();
});

/* ---------- startup ---------- */

window.addEventListener('resize', () => {
  if (!editor.loaded) return;
  if (state.step >= 2 && state.step <= 4) {
    editor.fitView();
    renderCurrent();
  } else if (state.step === 5) {
    refreshFinalPreview();
  }
});

window.addEventListener('beforeunload', (e) => {
  // Only nag when there is work that would be lost. After downloading, the
  // result is already on the user's disk.
  if (editor.loaded && !state.downloaded) e.preventDefault();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* without the SW the app still works; only offline mode is lost */
  });
}

buildTemplateList();
state.watermark.date = todayDate();
$('#fieldDate').value = state.watermark.date;
goToStep(1);
