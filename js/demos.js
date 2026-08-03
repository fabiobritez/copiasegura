/*
 * Copia Segura
 * Copyright (C) 2026 Fabio Britez
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * demos.js - Dictionary attack on pixelated text, run for real in the browser.
 *
 * It renders a number, pixelates it, then reconstructs each digit by trying the
 * ten candidates, pixelating each one the same way and keeping the closest
 * match. The procedure is from Hill et al. (2016), reduced to its simplest
 * form. Nothing is sent or received.
 *
 * The demo is deliberately the attacker's best case, with the same typeface and
 * size for the original and the candidates. That is exactly the situation of
 * someone attacking a standardised document, where the typeface is known.
 */

(function () {
  var root = document.getElementById('pixelDemo');
  if (!root) return;

  var FONT = '600 34px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  var DIGITS = 8;
  var BLOCK = 8; // mosaic side, in pixels
  var DIGIT_WIDTH = 40;
  var HEIGHT = 60;

  var cvOriginal = document.getElementById('cvOriginal');
  var cvPixelated = document.getElementById('cvPixelated');
  var cvRecovered = document.getElementById('cvRecovered');
  var statusEl = document.getElementById('demoStatus');
  var attackButton = document.getElementById('btnAttack');
  var otherButton = document.getElementById('btnOtherNumber');

  var number = '40123456';
  var working = false;

  /* ---------- drawing ---------- */

  function drawNumber(ctx, text, width, height) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#111827';
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (var i = 0; i < text.length; i++) {
      ctx.fillText(text[i], i * DIGIT_WIDTH + DIGIT_WIDTH / 2, height / 2);
    }
  }

  /* Classic pixelation: each block becomes the average of what it covers. That
   * average is precisely what gives the content away. */
  function pixelate(ctx, width, height) {
    var image = ctx.getImageData(0, 0, width, height);
    var d = image.data;
    for (var by = 0; by < height; by += BLOCK) {
      for (var bx = 0; bx < width; bx += BLOCK) {
        var sr = 0, sg = 0, sb = 0, n = 0;
        for (var y = by; y < Math.min(by + BLOCK, height); y++) {
          for (var x = bx; x < Math.min(bx + BLOCK, width); x++) {
            var p = (y * width + x) * 4;
            sr += d[p]; sg += d[p + 1]; sb += d[p + 2]; n++;
          }
        }
        var mr = sr / n, mg = sg / n, mb = sb / n;
        for (var y2 = by; y2 < Math.min(by + BLOCK, height); y2++) {
          for (var x2 = bx; x2 < Math.min(bx + BLOCK, width); x2++) {
            var q = (y2 * width + x2) * 4;
            d[q] = mr; d[q + 1] = mg; d[q + 2] = mb;
          }
        }
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  /* Off-screen canvas used to generate and pixelate candidates. */
  function scratchCanvas(width, height) {
    var c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }

  /* Difference between two pixelated blocks: lower means a better candidate. */
  function distance(a, b) {
    var sum = 0;
    for (var i = 0; i < a.length; i += 4) {
      var d = a[i] - b[i];
      sum += d * d;
    }
    return sum;
  }

  /* ---------- attack ---------- */

  function digitBlock(ctx, index) {
    return ctx.getImageData(index * DIGIT_WIDTH, 0, DIGIT_WIDTH, HEIGHT).data;
  }

  function recoverDigit(target) {
    var scratch = scratchCanvas(DIGIT_WIDTH, HEIGHT);
    var ctx = scratch.getContext('2d', { willReadFrequently: true });
    var best = '?';
    var bestDistance = Infinity;

    for (var d = 0; d <= 9; d++) {
      drawNumber(ctx, String(d), DIGIT_WIDTH, HEIGHT);
      pixelate(ctx, DIGIT_WIDTH, HEIGHT);
      var candidate = ctx.getImageData(0, 0, DIGIT_WIDTH, HEIGHT).data;
      var dist = distance(target, candidate);
      if (dist < bestDistance) {
        bestDistance = dist;
        best = String(d);
      }
    }
    return best;
  }

  function runAttack() {
    if (working) return;
    working = true;
    attackButton.disabled = true;
    otherButton.disabled = true;

    var ctxPix = cvPixelated.getContext('2d', { willReadFrequently: true });
    var ctxRec = cvRecovered.getContext('2d');
    ctxRec.fillStyle = '#ffffff';
    ctxRec.fillRect(0, 0, cvRecovered.width, cvRecovered.height);

    var recovered = '';
    var i = 0;

    function next() {
      if (i >= DIGITS) {
        statusEl.textContent =
          'Número reconstruido: ' + recovered + '. Probados 10 candidatos por dígito, ' +
          DIGITS * 10 + ' comparaciones en total.';
        statusEl.className = 'demo-status success';
        attackButton.disabled = false;
        otherButton.disabled = false;
        working = false;
        return;
      }

      var target = digitBlock(ctxPix, i);
      var digit = recoverDigit(target);
      recovered += digit;

      ctxRec.fillStyle = '#111827';
      ctxRec.font = FONT;
      ctxRec.textBaseline = 'middle';
      ctxRec.textAlign = 'center';
      ctxRec.fillText(digit, i * DIGIT_WIDTH + DIGIT_WIDTH / 2, HEIGHT / 2);

      statusEl.className = 'demo-status';
      statusEl.textContent =
        'Probando candidatos para la posición ' + (i + 1) + ' de ' + DIGITS +
        '. Reconstruido hasta ahora: ' + recovered;

      i++;
      // One digit per frame so the process is visible; the real speed is
      // milliseconds.
      setTimeout(next, 260);
    }

    next();
  }

  /* ---------- initialisation ---------- */

  function prepare() {
    var width = DIGITS * DIGIT_WIDTH;
    [cvOriginal, cvPixelated, cvRecovered].forEach(function (c) {
      c.width = width;
      c.height = HEIGHT;
    });

    drawNumber(cvOriginal.getContext('2d'), number, width, HEIGHT);

    var ctxPix = cvPixelated.getContext('2d', { willReadFrequently: true });
    drawNumber(ctxPix, number, width, HEIGHT);
    pixelate(ctxPix, width, HEIGHT);

    var ctxRec = cvRecovered.getContext('2d');
    ctxRec.fillStyle = '#ffffff';
    ctxRec.fillRect(0, 0, width, HEIGHT);

    statusEl.className = 'demo-status';
    statusEl.textContent =
      'Presioná «Ejecutar el ataque» para reconstruir el número a partir de la imagen pixelada.';
  }

  function randomNumber() {
    var n = '';
    var bytes = new Uint8Array(DIGITS);
    crypto.getRandomValues(bytes);
    for (var i = 0; i < DIGITS; i++) n += String(bytes[i] % 10);
    return n;
  }

  attackButton.addEventListener('click', runAttack);
  otherButton.addEventListener('click', function () {
    if (working) return;
    number = randomNumber();
    prepare();
  });

  prepare();
})();
