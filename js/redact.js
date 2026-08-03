/*
 * Copia Segura
 * Copyright (C) 2026 Fabio Britez
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * redact.js - Destructive redaction.
 *
 * GOLDEN RULE: no redaction function reads the pixels it is about to cover, so
 * a redacted area's output is independent of its original content. Only two
 * techniques qualify: a constant solid fill and CSPRNG noise. Blur and
 * pixelation are excluded because they compute the output FROM the covered
 * content, which makes them reversible (deconvolution, dictionary attacks,
 * Depix). See docs/OFUSCACION.md.
 */

// crypto.getRandomValues accepts at most 65536 bytes per call.
const RANDOM_CHUNK = 65536;

class Redactor {
  constructor() {
    // Undo stack, memory only: persisting it would write an UNREDACTED copy of
    // the document to disk.
    this._stack = [];
  }

  get availableSteps() {
    return this._stack.length;
  }

  // Destructive and immediate.
  // zones: [{ rect: {x, y, width, height} }]  ·  mode: 'solid' | 'noise'
  apply(master, zones, mode) {
    const ctx = master.getContext('2d');
    // Redaction works in absolute master coordinates and must be immune to any
    // transform another module left on this context: a residual one would make
    // fillRect cover a region other than the one the user confirmed.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const zone of zones) {
      const r = this._clamp(zone.rect, master.width, master.height);
      if (r.width < 1 || r.height < 1) continue;

      // Only legitimate getImageData here: the in-memory undo snapshot.
      this._stack.push({ x: r.x, y: r.y, image: ctx.getImageData(r.x, r.y, r.width, r.height) });

      if (mode === 'noise') {
        this._fillWithNoise(ctx, r);
      } else {
        this._fillSolid(ctx, r);
      }
    }
    ctx.restore();
  }

  _fillSolid(ctx, r) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(r.x, r.y, r.width, r.height);
  }

  _fillWithNoise(ctx, r) {
    // Grayscale noise from the browser CSPRNG, never derived from the image:
    // "perturbing" or "blending" the existing pixels would leak the content
    // while looking secure.
    const total = r.width * r.height;
    const random = new Uint8Array(total);
    for (let i = 0; i < total; i += RANDOM_CHUNK) {
      crypto.getRandomValues(random.subarray(i, Math.min(i + RANDOM_CHUNK, total)));
    }
    const image = ctx.createImageData(r.width, r.height);
    const data = image.data;
    for (let i = 0; i < total; i++) {
      const v = random[i];
      const j = i * 4;
      data[j] = v;
      data[j + 1] = v;
      data[j + 2] = v;
      data[j + 3] = 255;
    }
    ctx.putImageData(image, r.x, r.y);
  }

  undo(master) {
    const step = this._stack.pop();
    if (!step) return false;
    master.getContext('2d').putImageData(step.image, step.x, step.y);
    return true;
  }

  clear() {
    this._stack = [];
  }

  /*
   * Rounds outwards, never inwards: the covered area must always be a superset
   * of what the user selected. Rounding the origin and the size independently
   * can shrink the rectangle and leave a sliver of the original showing along
   * an edge.
   */
  _clamp(rect, maxWidth, maxHeight) {
    const x0 = Math.max(0, Math.floor(rect.x));
    const y0 = Math.max(0, Math.floor(rect.y));
    const x1 = Math.min(maxWidth, Math.ceil(rect.x + rect.width));
    const y1 = Math.min(maxHeight, Math.ceil(rect.y + rect.height));
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }
}
