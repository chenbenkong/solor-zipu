import * as THREE from 'three';

/**
 * Procedural moon texture generator — canvas-based, no external images needed.
 * Each moon gets a distinctive look via layered noise + color ramping.
 */

function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Simple seeded PRNG for deterministic noise
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Value noise 2D
function valueNoise(x, y, rand) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);

  const hash = (a, b) => {
    const n = (a * 374761393 + b * 668265263) | 0;
    return rand(((n ^ (n >> 13)) & 0x7fffffff) % 10000) * 2 - 1;
  };

  const n00 = hash(ix, iy), n10 = hash(ix + 1, iy);
  const n01 = hash(ix, iy + 1), n11 = hash(ix + 1, iy + 1);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function fbm(x, y, octaves, rand) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise(x * freq, y * freq, rand);
    amp *= 0.5;
    freq *= 2.0;
  }
  return val;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

/**
 * Io — sulfurous yellow-orange with volcanic dark spots and white frost
 */
export function generateIoTexture(size = 512) {
  const cvs = createCanvas(size, size);
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rand = mulberry32(42);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n1 = fbm(u * 8, v * 8, 6, rand);
      const n2 = fbm(u * 12 + 10, v * 12 + 10, 4, rand);
      const n3 = fbm(u * 20 + 20, v * 20 + 20, 3, rand);

      // Base: sulfurous yellow-orange
      let r = 210 + n1 * 40;
      let g = 170 + n1 * 30 - n2 * 25;
      let b = 60 + n3 * 30;

      // Volcanic dark patches (low noise regions)
      const volcanic = smoothstep(-0.1, 0.1, n2);
      r = lerp(80, r, volcanic);
      g = lerp(50, g, volcanic);
      b = lerp(30, b, volcanic);

      // White sulfur frost (high noise peaks)
      const frost = smoothstep(0.35, 0.55, n3);
      r = lerp(r, 240, frost * 0.6);
      g = lerp(g, 235, frost * 0.6);
      b = lerp(b, 220, frost * 0.5);

      // Red volcanic caldera spots
      const caldera = smoothstep(0.2, 0.35, fbm(u * 30 + 50, v * 30 + 50, 2, rand));
      r = lerp(r, 180, caldera * 0.7);
      g = lerp(g, 40, caldera * 0.7);
      b = lerp(b, 20, caldera * 0.7);

      const i = (y * size + x) * 4;
      img.data[i] = clamp(r, 0, 255);
      img.data[i + 1] = clamp(g, 0, 255);
      img.data[i + 2] = clamp(b, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cvs);
}

/**
 * Europa — icy white-blue with reddish-brown crack lines
 */
export function generateEuropaTexture(size = 512) {
  const cvs = createCanvas(size, size);
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rand = mulberry32(77);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n1 = fbm(u * 6, v * 6, 5, rand);
      const n2 = fbm(u * 15 + 5, v * 15 + 5, 4, rand);
      // Line network: use high-freq noise ridges
      const lineX = Math.abs(Math.sin((u * 25 + n1 * 3) * Math.PI));
      const lineY = Math.abs(Math.sin((v * 20 + n2 * 2.5) * Math.PI));
      const crack = 1 - Math.min(lineX, lineY);
      const crackMask = smoothstep(0.85, 0.95, crack);

      // Base: bright icy white-blue
      let r = 215 + n1 * 20;
      let g = 220 + n1 * 15;
      let b = 235 + n1 * 10;

      // Slightly darker regions (subsurface texture)
      const depth = smoothstep(-0.2, 0.3, n2);
      r = lerp(195, r, depth);
      g = lerp(200, g, depth);
      b = lerp(215, b, depth);

      // Red-brown cracks
      r = lerp(r, 160, crackMask * 0.8);
      g = lerp(g, 70, crackMask * 0.8);
      b = lerp(b, 40, crackMask * 0.7);

      const i = (y * size + x) * 4;
      img.data[i] = clamp(r, 0, 255);
      img.data[i + 1] = clamp(g, 0, 255);
      img.data[i + 2] = clamp(b, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cvs);
}

/**
 * Ganymede — grey-brown with lighter crater regions and dark maria
 */
export function generateGanymedeTexture(size = 512) {
  const cvs = createCanvas(size, size);
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rand = mulberry32(123);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n1 = fbm(u * 7, v * 7, 6, rand);
      const n2 = fbm(u * 14 + 20, v * 14 + 20, 5, rand);
      const n3 = fbm(u * 25 + 40, v * 25 + 40, 3, rand);

      // Base: medium grey-brown
      let r = 145 + n1 * 30;
      let g = 135 + n1 * 25;
      let b = 120 + n1 * 20;

      // Bright cratered highlands
      const highland = smoothstep(0.15, 0.4, n2);
      r = lerp(r, 185, highland * 0.5);
      g = lerp(g, 175, highland * 0.5);
      b = lerp(b, 160, highland * 0.4);

      // Darker maria (smooth lowlands)
      const maria = smoothstep(0.0, 0.2, -n2);
      r = lerp(r, 95, maria * 0.5);
      g = lerp(g, 85, maria * 0.5);
      b = lerp(b, 75, maria * 0.4);

      // Fresh bright crater rays
      const ray = smoothstep(0.4, 0.6, n3);
      r = lerp(r, 200, ray * 0.3);
      g = lerp(g, 195, ray * 0.3);
      b = lerp(b, 185, ray * 0.3);

      const i = (y * size + x) * 4;
      img.data[i] = clamp(r, 0, 255);
      img.data[i + 1] = clamp(g, 0, 255);
      img.data[i + 2] = clamp(b, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cvs);
}

/**
 * Callisto — very dark heavily cratered surface with bright white ray craters
 */
export function generateCallistoTexture(size = 512) {
  const cvs = createCanvas(size, size);
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rand = mulberry32(256);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n1 = fbm(u * 8, v * 8, 6, rand);
      const n2 = fbm(u * 20 + 30, v * 20 + 30, 5, rand);
      const n3 = fbm(u * 40 + 60, v * 40 + 60, 3, rand);

      // Base: very dark grey-brown
      let r = 65 + n1 * 25;
      let g = 58 + n1 * 20;
      let b = 50 + n1 * 18;

      // Crater density variations
      const cratered = smoothstep(-0.15, 0.15, n2);
      r = lerp(r, 50, cratered * 0.3);
      g = lerp(g, 44, cratered * 0.3);
      b = lerp(b, 38, cratered * 0.3);

      // Bright impact rays (Vesta-like)
      const rayBright = smoothstep(0.3, 0.5, n3);
      r = lerp(r, 200, rayBright * 0.5);
      g = lerp(g, 195, rayBright * 0.5);
      b = lerp(b, 185, rayBright * 0.4);

      // Occasional icy patch
      const ice = smoothstep(0.5, 0.7, fbm(u * 10 + 80, v * 10 + 80, 2, rand));
      r = lerp(r, 180, ice * 0.3);
      g = lerp(g, 185, ice * 0.3);
      b = lerp(b, 195, ice * 0.3);

      const i = (y * size + x) * 4;
      img.data[i] = clamp(r, 0, 255);
      img.data[i + 1] = clamp(g, 0, 255);
      img.data[i + 2] = clamp(b, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cvs);
}

/**
 * Titan — opaque orange haze, no surface visible (thick atmosphere)
 */
export function generateTitanTexture(size = 512) {
  const cvs = createCanvas(size, size);
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rand = mulberry32(333);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n1 = fbm(u * 5, v * 5, 5, rand);
      const n2 = fbm(u * 8 + 15, v * 8 + 15, 4, rand);

      // Deep orange haze layers
      let r = 210 + n1 * 30;
      let g = 150 + n1 * 25 + n2 * 15;
      let b = 50 + n2 * 30;

      // Darker equatorial band
      const lat = Math.abs(v - 0.5) * 2;
      const band = smoothstep(0.3, 0.6, lat);
      r = lerp(r, 180, band * 0.3);
      g = lerp(g, 120, band * 0.3);
      b = lerp(b, 40, band * 0.3);

      // Subtle high-altitude haze brightening
      const haze = smoothstep(0.0, 0.5, n1);
      r = lerp(r, 230, haze * 0.2);
      g = lerp(g, 175, haze * 0.2);
      b = lerp(b, 70, haze * 0.15);

      const i = (y * size + x) * 4;
      img.data[i] = clamp(r, 0, 255);
      img.data[i + 1] = clamp(g, 0, 255);
      img.data[i + 2] = clamp(b, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cvs);
}

/**
 * Enceladus — very bright white ice with subtle blue tiger stripes
 */
export function generateEnceladusTexture(size = 512) {
  const cvs = createCanvas(size, size);
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rand = mulberry32(512);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n1 = fbm(u * 6, v * 6, 5, rand);
      const n2 = fbm(u * 12 + 10, v * 12 + 10, 4, rand);

      // Base: brilliant white ice
      let r = 235 + n1 * 15;
      let g = 238 + n1 * 12;
      let b = 242 + n1 * 10;

      // Subtle grey terrain variation
      const terrain = smoothstep(-0.2, 0.2, n2);
      r = lerp(215, r, terrain);
      g = lerp(218, g, terrain);
      b = lerp(225, b, terrain);

      // Blue tiger stripe fractures (south pole region)
      const stripe = Math.abs(Math.sin((u * 15 + n1 * 2) * Math.PI));
      const stripeMask = smoothstep(0.9, 0.98, stripe) * smoothstep(0.7, 1.0, v);
      r = lerp(r, 140, stripeMask * 0.5);
      g = lerp(g, 170, stripeMask * 0.5);
      b = lerp(b, 220, stripeMask * 0.6);

      const i = (y * size + x) * 4;
      img.data[i] = clamp(r, 0, 255);
      img.data[i + 1] = clamp(g, 0, 255);
      img.data[i + 2] = clamp(b, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cvs);
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Map moon name to its texture generator
 */
export const MOON_TEXTURE_GENERATORS = {
  '木卫一（伊奥）': generateIoTexture,
  '木卫二（欧罗巴）': generateEuropaTexture,
  '木卫三（盖尼米德）': generateGanymedeTexture,
  '木卫四（卡里斯托）': generateCallistoTexture,
  '土卫六（泰坦）': generateTitanTexture,
  '土卫二（恩克拉多斯）': generateEnceladusTexture,
  '月球': null, // uses moon.jpg texture
};
