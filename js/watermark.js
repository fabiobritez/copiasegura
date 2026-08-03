/*
 * Copia Segura
 * Copyright (C) 2026 Fabio Britez
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * watermark.js - Watermark with a tracing signature.
 *
 * Deterrence: visible text tiled over the whole document, valuable areas
 * included, so removing it degrades what makes the copy useful. Tracing: a copy
 * code (truncated SHA-256 of "recipient|purpose|date") repeated in the pattern,
 * so the user can recompute the codes of the copies they issued and tell which
 * one leaked, without storing anything.
 *
 * No steganography: an invisible mark survives neither recompression nor a
 * screenshot, and promising invisible tracing would be false security.
 */

const CODE_LENGTH = 10;

async function copyCode(recipient, purpose, date) {
  const text = [recipient, purpose, date].join('|');
  if (crypto.subtle) {
    const bytes = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return toHex(new Uint8Array(hash)).slice(0, CODE_LENGTH).toUpperCase();
  }
  // No SubtleCrypto outside a secure context. FNV-1a is enough to tell copies
  // apart (the code identifies, it does not authenticate); prefixed so the
  // difference is visible.
  return 'X' + fnv1a(text).slice(0, CODE_LENGTH - 1).toUpperCase();
}

/*
 * Burns the mark onto a 2D context. Used with the same code for the on-screen
 * preview and for the export canvas, so what is seen is what gets downloaded.
 * options: { line1, code, opacity (0..1) }
 */
function drawWatermark(ctx, width, height, options) {
  const line1 = (options.line1 || '').trim();
  const line2 = options.code ? 'COPIA COD: ' + options.code : '';
  if (!line1 && !line2) return;

  const opacity = typeof options.opacity === 'number' ? options.opacity : 0.28;
  const diagonal = Math.hypot(width, height);
  // A fine, tight mesh: small type and close spacing fit many more instances in
  // the same area, so more of the copy code has to be removed for the mark to
  // disappear. Spacing stops short of overlap, which would hurt legibility
  // without making removal any harder.
  const fontSize = Math.max(12, Math.round(diagonal / 42.5));

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const font1 = '600 ' + fontSize + 'px system-ui, sans-serif';
  const font2 = '600 ' + Math.round(fontSize * 0.6) + 'px system-ui, sans-serif';

  ctx.font = font1;
  const line1Width = Math.max(ctx.measureText(line1 || line2).width, fontSize * 6);
  const stepX = line1Width * 1.08;
  const stepY = fontSize * 3.68;

  let row = 0;
  for (let y = -diagonal; y <= diagonal; y += stepY, row++) {
    const offset = row % 2 ? stepX / 2 : 0;
    for (let x = -diagonal; x <= diagonal; x += stepX) {
      // Light behind, dark in front: legible over dark and light backgrounds.
      if (line1) {
        ctx.font = font1;
        ctx.fillStyle = 'rgba(255,255,255,' + opacity * 0.9 + ')';
        ctx.fillText(line1, x + offset + 1, y + 1);
        ctx.fillStyle = 'rgba(15,23,42,' + opacity + ')';
        ctx.fillText(line1, x + offset, y);
      }
      if (line2) {
        const dy = line1 ? fontSize * 1.15 : 0;
        ctx.font = font2;
        ctx.fillStyle = 'rgba(255,255,255,' + opacity * 0.9 + ')';
        ctx.fillText(line2, x + offset + 1, y + dy + 1);
        ctx.fillStyle = 'rgba(15,23,42,' + opacity + ')';
        ctx.fillText(line2, x + offset, y + dy);
      }
    }
  }
  ctx.restore();
}

/* ---------- helpers ---------- */

function toHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const mixed = Math.imul(hash, 0x9e3779b1) >>> 0;
  return hash.toString(16).padStart(8, '0') + mixed.toString(16).padStart(8, '0');
}
