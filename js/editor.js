/*
 * Copia Segura
 * Copyright (C) 2026 Fabio Britez
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * editor.js - Master canvas and scaled view.
 *
 * ALL destructive operations are applied to the master canvas at native
 * resolution. What the user sees is a read-only scaled mirror that only draws
 * the master plus the interface guides. This closes the classic redaction bug:
 * covering something on an 800 px preview and exporting the 4000 px original
 * with the data intact.
 */

// Maximum master side. Phone photos can exceed 8000 px; beyond this cap they
// add no legibility and risk hitting the iOS canvas limit (~16.7 Mpx).
const MAX_SIDE = 3000;

class Editor {
  constructor(viewCanvas) {
    this.view = viewCanvas;
    this.viewCtx = viewCanvas.getContext('2d');
    this.master = null;   // native-resolution canvas: the single source of truth
    this.original = null; // pre-crop copy, so the framing can be restored
    this.scale = 1;       // master to view
  }

  get loaded() {
    return this.master !== null;
  }

  /* ---------- loading ---------- */

  async loadFile(file) {
    const bitmap = await this._decode(file);

    let width = bitmap.width;
    let height = bitmap.height;
    const longest = Math.max(width, height);
    if (longest > MAX_SIDE) {
      const factor = MAX_SIDE / longest;
      width = Math.round(width * factor);
      height = Math.round(height * factor);
    }

    // Re-rendering through a canvas is where EXIF, geolocation and the embedded
    // thumbnail of the original file die. No byte of the uploaded file reaches
    // the result.
    this.master = this._newCanvas(width, height);
    this.master.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    if (bitmap.close) bitmap.close();

    this.original = this._clone(this.master);
    this.fitView();
  }

  async _decode(file) {
    // createImageBitmap with 'from-image' honours the EXIF orientation of phone
    // photos. If the browser lacks the option, degrade gracefully.
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (e) {
        try {
          return await createImageBitmap(file);
        } catch (e2) {
          /* fall through to plan C */
        }
      }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo leer la imagen.'));
      };
      img.src = url;
    });
  }

  /* ---------- geometry ("Document" step) ---------- */

  rotate90() {
    if (!this.loaded) return;
    this.master = this._rotated(this.master);
    // The backup rotates along with the master so that "restore framing" keeps
    // the chosen orientation.
    this.original = this._rotated(this.original);
    this.fitView();
  }

  _rotated(canvas) {
    const out = this._newCanvas(canvas.height, canvas.width);
    const ctx = out.getContext('2d');
    ctx.translate(out.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, 0, 0);
    // Back to identity: this context belongs to the master and stays alive. A
    // residual transform would make any later drawing (the solid fill of the
    // redaction, for one) land rotated and offset, covering a region other than
    // the one the user confirmed.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return out;
  }

  // A single operation covers cropping, tilt and perspective.
  applyCorners(corners) {
    if (!this.loaded) return false;
    if (!isValidQuadrilateral(corners)) return false;
    const out = rectifyQuadrilateral(this.master, corners, MAX_SIDE);
    if (!out) return false;
    this.master = out;
    this.fitView();
    return true;
  }

  // Slightly inside the edge, so the four handles are fully visible and
  // grabbable.
  initialCorners() {
    return this._corners(0.06);
  }

  // Corners flush with the edge, which is what belongs after straightening: the
  // image already IS the cropped document.
  edgeCorners() {
    return this._corners(0);
  }

  _corners(ratio) {
    if (!this.loaded) return null;
    const m = Math.round(Math.min(this.master.width, this.master.height) * ratio);
    const left = m;
    const right = this.master.width - m;
    const top = m;
    const bottom = this.master.height - m;
    return [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ];
  }

  clampToMaster(point) {
    return {
      x: Math.max(0, Math.min(this.master.width, point.x)),
      y: Math.max(0, Math.min(this.master.height, point.y)),
    };
  }

  restoreFraming() {
    if (!this.original) return;
    this.master = this._clone(this.original);
    this.fitView();
  }

  /* ---------- coordinates ---------- */

  // Translates a pointer event on the view into master coordinates.
  masterPoint(event) {
    const box = this.view.getBoundingClientRect();
    const x = (event.clientX - box.left) / this.scale;
    const y = (event.clientY - box.top) / this.scale;
    return {
      x: Math.max(0, Math.min(this.master.width, x)),
      y: Math.max(0, Math.min(this.master.height, y)),
    };
  }

  /* ---------- view ---------- */

  fitView() {
    if (!this.loaded) return;
    const container = this.view.parentElement;
    const availableWidth = Math.max(200, container.clientWidth);
    const availableHeight = Math.max(200, Math.round(window.innerHeight * 0.62));
    this.scale = Math.min(
      1,
      availableWidth / this.master.width,
      availableHeight / this.master.height
    );

    const cssWidth = Math.round(this.master.width * this.scale);
    const cssHeight = Math.round(this.master.height * this.scale);
    const dpr = window.devicePixelRatio || 1;
    this.view.width = Math.round(cssWidth * dpr);
    this.view.height = Math.round(cssHeight * dpr);
    this.view.style.width = cssWidth + 'px';
    this.view.style.height = cssHeight + 'px';
    this.viewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /*
   * Repaints the view: the scaled master plus whatever guides the interface
   * asks for. Guides are purely visual: nothing drawn here ever reaches the
   * exported file.
   *
   * guides = { zones: [...], dragRect: {...}, watermark: fn(ctx, w, h) }
   */
  render(guides) {
    if (!this.loaded) return;
    const g = guides || {};
    const ctx = this.viewCtx;
    const cssWidth = this.master.width * this.scale;
    const cssHeight = this.master.height * this.scale;

    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.drawImage(this.master, 0, 0, cssWidth, cssHeight);

    // Watermark preview (only burned in at export time).
    if (g.watermark) {
      g.watermark(ctx, cssWidth, cssHeight);
    }

    if (g.zones) {
      for (const zone of g.zones) {
        this._drawZone(ctx, zone);
      }
    }

    if (g.corners) {
      this._drawCorners(ctx, g.corners, cssWidth, cssHeight);
    }

    if (g.dragRect) {
      const r = this._normalizeRect(g.dragRect);
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(
        r.x * this.scale,
        r.y * this.scale,
        r.width * this.scale,
        r.height * this.scale
      );
      ctx.restore();
    }
  }

  // Darkening the discarded area is what makes it obvious at a glance what is
  // kept.
  _drawCorners(ctx, corners, cssWidth, cssHeight) {
    const s = this.scale;
    const p = corners.map((q) => ({ x: q.x * s, y: q.y * s }));

    ctx.save();

    // Mask: the whole canvas minus the quadrilateral (even-odd rule).
    ctx.beginPath();
    ctx.rect(0, 0, cssWidth, cssHeight);
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fill('evenodd');

    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.closePath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // With the corners on the edge the circle gets half clipped by the canvas,
    // which is correct: it signals they are flush.
    for (const q of p) {
      ctx.beginPath();
      ctx.arc(q.x, q.y, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      // Centre dot: the exact vertex the user aims at.
      ctx.beginPath();
      ctx.arc(q.x, q.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#1d4ed8';
      ctx.fill();
    }
    ctx.restore();
  }

  _drawZone(ctx, zone) {
    const s = this.scale;
    const [x, y, w, h] = [
      zone.rect.x * s,
      zone.rect.y * s,
      zone.rect.width * s,
      zone.rect.height * s,
    ];
    ctx.save();
    if (zone.active) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.35)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
    }
    ctx.strokeRect(x, y, w, h);

    if (zone.label) {
      ctx.setLineDash([]);
      ctx.font = '600 12px system-ui, sans-serif';
      const textWidth = ctx.measureText(zone.label).width;
      const ty = y > 18 ? y - 6 : y + h + 14;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(x - 2, ty - 11, textWidth + 8, 15);
      ctx.fillStyle = zone.active ? '#b91c1c' : '#475569';
      ctx.fillText(zone.label, x + 2, ty);
    }
    ctx.restore();
  }

  /* ---------- cleanup ---------- */

  reset() {
    // Setting the canvases to 0×0 releases their pixel buffers immediately
    // instead of waiting for the garbage collector.
    for (const c of [this.master, this.original]) {
      if (c) {
        c.width = 0;
        c.height = 0;
      }
    }
    this.master = null;
    this.original = null;
    this.viewCtx.clearRect(0, 0, this.view.width, this.view.height);
  }

  /* ---------- helpers ---------- */

  _newCanvas(width, height) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }

  _clone(canvas) {
    const c = this._newCanvas(canvas.width, canvas.height);
    c.getContext('2d').drawImage(canvas, 0, 0);
    return c;
  }

  _normalizeRect(r) {
    return {
      x: Math.round(Math.min(r.x0, r.x1)),
      y: Math.round(Math.min(r.y0, r.y1)),
      width: Math.round(Math.abs(r.x1 - r.x0)),
      height: Math.round(Math.abs(r.y1 - r.y0)),
    };
  }
}
