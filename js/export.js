/*
 * Copia Segura
 * Copyright (C) 2026 Fabio Britez
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * export.js - Builds and downloads the final file.
 *
 * The file is always generated from scratch with canvas.toBlob() on a fresh
 * canvas, never by editing the original: no byte of the user's file is copied
 * over, which strips EXIF, geolocation, the embedded thumbnail and
 * aCropalypse-style leftovers. The download name is generic and fixed because
 * the original file name is personal metadata. Grayscale and watermark are
 * burned in before the encode, so no format can weaken them.
 */

// Copy of the (already redacted) master plus the optional grayscale and
// watermark. The master is left untouched so the user can go back and adjust
// options without redoing the redaction.
function composeFinal(master, options) {
  const o = options || {};
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = master.width;
  finalCanvas.height = master.height;
  const ctx = finalCanvas.getContext('2d');
  ctx.drawImage(master, 0, 0);

  if (o.grayscale) {
    toGrayscale(ctx, finalCanvas.width, finalCanvas.height);
  }

  if (o.watermark && (o.watermark.line1 || o.watermark.code)) {
    drawWatermark(ctx, finalCanvas.width, finalCanvas.height, o.watermark);
  }

  return finalCanvas;
}

// ITU-R BT.709 luminance. Manual loop instead of ctx.filter='grayscale()' for
// compatibility (Safari took years to support canvas filters).
function toGrayscale(ctx, width, height) {
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    d[i] = gray;
    d[i + 1] = gray;
    d[i + 2] = gray;
  }
  ctx.putImageData(image, 0, 0);
}

function download(canvas, format) {
  const isJpeg = format === 'jpeg';
  const type = isJpeg ? 'image/jpeg' : 'image/png';
  const date = new Date().toISOString().slice(0, 10);
  const name = 'copia-segura_' + date + (isJpeg ? '.jpg' : '.png');

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('El navegador no pudo generar el archivo.'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Some browsers need the URL alive until the download completes.
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        resolve(name);
      },
      type,
      isJpeg ? 0.92 : undefined
    );
  });
}
