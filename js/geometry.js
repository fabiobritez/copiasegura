/*
 * Copia Segura
 * Copyright (C) 2026 Fabio Britez
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * geometry.js - Four-corner rectification (perspective correction).
 *
 * The user marks the four corners of the document at any angle and any tilt,
 * and they come out straightened into a rectangle. A rectangular crop cannot do
 * that; a homography can. All local, no dependencies.
 */

/*
 * Homography mapping the four `from` points onto the four `to` points, as the
 * 8 coefficients [a..h] of
 *   x = (a·u + b·v + c) / (g·u + h·v + 1),  y = (d·u + e·v + f) / (g·u + h·v + 1)
 * Partial pivoting avoids dividing by ~0 when two corners nearly coincide.
 */
function solveHomography(from, to) {
  const M = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = from[i];
    const { x, y } = to[i];
    M.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
    M.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
  }

  for (let col = 0; col < 8; col++) {
    let best = col;
    for (let row = col + 1; row < 8; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[best][col])) best = row;
    }
    if (Math.abs(M[best][col]) < 1e-10) return null; // degenerate system
    const tmp = M[col];
    M[col] = M[best];
    M[best] = tmp;

    const pivot = M[col][col];
    for (let k = col; k <= 8; k++) M[col][k] /= pivot;

    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      if (!factor) continue;
      for (let k = col; k <= 8; k++) M[row][k] -= factor * M[col][k];
    }
  }
  return M.map((row) => row[8]);
}

function distance(p, q) {
  return Math.hypot(q.x - p.x, q.y - p.y);
}

// Output size: the length of the longest sides, so no part of the document
// loses resolution.
function outputSize(corners, maxSide) {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  let width = Math.max(distance(topLeft, topRight), distance(bottomLeft, bottomRight));
  let height = Math.max(distance(topLeft, bottomLeft), distance(topRight, bottomRight));
  const longest = Math.max(width, height);
  if (longest > maxSide) {
    const factor = maxSide / longest;
    width *= factor;
    height *= factor;
  }
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

/*
 * Rectifies the `corners` quadrilateral of the source canvas into a new
 * rectangular canvas. Inverse mapping (walk the DESTINATION pixels and look up
 * where each comes from) because a forward mapping leaves unpainted holes
 * wherever the transform enlarges an area; bilinear sampling because nearest
 * neighbour turns the small print of a document jagged and unreadable.
 */
function rectifyQuadrilateral(source, corners, maxSide) {
  const { width, height } = outputSize(corners, maxSide);

  // Homography from the output rectangle to the source quadrilateral.
  const h = solveHomography(
    [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    corners
  );
  if (!h) return null;
  const [a, b, c, d, e, f, g, i] = h;

  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  const src = sourceCtx.getImageData(0, 0, source.width, source.height);
  const sd = src.data;
  const sw = source.width;
  const sh = source.height;

  const dest = document.createElement('canvas');
  dest.width = width;
  dest.height = height;
  const out = dest.getContext('2d').createImageData(width, height);
  const dd = out.data;

  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      const w = g * u + i * v + 1;
      const x = (a * u + b * v + c) / w;
      const y = (d * u + e * v + f) / w;
      const p = (v * width + u) * 4;

      if (x < 0 || y < 0 || x > sw - 1 || y > sh - 1) {
        // Outside the original: opaque white, since the result is exported as a
        // flat image and a transparent hole reads as black in many viewers.
        dd[p] = dd[p + 1] = dd[p + 2] = 255;
        dd[p + 3] = 255;
        continue;
      }

      const x0 = x | 0;
      const y0 = y | 0;
      const x1 = x0 + 1 > sw - 1 ? x0 : x0 + 1;
      const y1 = y0 + 1 > sh - 1 ? y0 : y0 + 1;
      const fx = x - x0;
      const fy = y - y0;

      const q00 = (y0 * sw + x0) * 4;
      const q10 = (y0 * sw + x1) * 4;
      const q01 = (y1 * sw + x0) * 4;
      const q11 = (y1 * sw + x1) * 4;

      for (let channel = 0; channel < 3; channel++) {
        const top = sd[q00 + channel] + (sd[q10 + channel] - sd[q00 + channel]) * fx;
        const bottom = sd[q01 + channel] + (sd[q11 + channel] - sd[q01 + channel]) * fx;
        dd[p + channel] = top + (bottom - top) * fy;
      }
      dd[p + 3] = 255;
    }
  }

  dest.getContext('2d').putImageData(out, 0, 0);
  return dest;
}

// Rejects overlapping corners and self-crossing (bow-tie) shapes.
function isValidQuadrilateral(corners) {
  for (let i = 0; i < 4; i++) {
    if (distance(corners[i], corners[(i + 1) % 4]) < 12) return false;
  }
  // Convex if every consecutive cross product has the same sign.
  let positive = 0;
  for (let i = 0; i < 4; i++) {
    const p = corners[i];
    const q = corners[(i + 1) % 4];
    const r = corners[(i + 2) % 4];
    const cross = (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
    if (cross > 0) positive++;
  }
  return positive === 0 || positive === 4;
}
