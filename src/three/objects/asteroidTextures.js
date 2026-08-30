import * as THREE from 'three';

/**
 * Procedural asteroid surface texture + normal map.
 * Generates a rocky, cratered surface on a canvas.
 */
export function createAsteroidTextures(size = 1024, seed = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Seeded PRNG
  let s = seed + 1;
  const rand = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };

  // Base rocky color
  const baseR = 100 + rand() * 40;
  const baseG = 90 + rand() * 35;
  const baseB = 75 + rand() * 30;

  // Fill base
  ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  ctx.fillRect(0, 0, size, size);

  // Noise layers for surface variation
  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5, freq = 3;
      for (let o = 0; o < 5; o++) {
        const n = Math.sin(x * freq * 0.013 + seed) * Math.cos(y * freq * 0.017 + seed * 0.7);
        v += amp * n;
        amp *= 0.5;
        freq *= 2.1;
      }
      const shade = v * 50;
      const i = (y * size + x) * 4;
      d[i] = Math.max(30, Math.min(220, baseR + shade));
      d[i + 1] = Math.max(25, Math.min(210, baseG + shade * 0.9));
      d[i + 2] = Math.max(20, Math.min(200, baseB + shade * 0.8));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // Craters: dark ring + bright rim
  const craterCount = 30 + Math.floor(rand() * 40);
  for (let i = 0; i < craterCount; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = 2 + rand() * (size * 0.08);
    // Dark floor
    ctx.fillStyle = `rgba(30,25,20,${0.3 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Bright rim
    ctx.strokeStyle = `rgba(180,170,155,${0.2 + rand() * 0.25})`;
    ctx.lineWidth = 0.8 + rand();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cracks / ridges
  ctx.strokeStyle = 'rgba(40,35,28,0.3)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 15; i++) {
    let x = rand() * size, y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 4 + Math.floor(rand() * 8);
    for (let st = 0; st < steps; st++) {
      x += (rand() - 0.5) * size * 0.12;
      y += (rand() - 0.5) * size * 0.12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = 4;

  // Generate normal map from the albedo
  const normal = generateNormalMap(canvas, size);

  return { albedo, normal };
}

function generateNormalMap(srcCanvas, size) {
  const work = document.createElement('canvas');
  work.width = size;
  work.height = size;
  const wctx = work.getContext('2d');
  wctx.drawImage(srcCanvas, 0, 0, size, size);
  const px = wctx.getImageData(0, 0, size, size).data;

  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const octx = out.getContext('2d');
  const odata = octx.createImageData(size, size);

  const lum = (x, y) => {
    const xi = (x + size) % size, yi = (y + size) % size;
    const i = (yi * size + xi) * 4;
    return (px[i] + px[i + 1] + px[i + 2]) / 3;
  };

  const strength = 3.0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = lum(x + 1, y) - lum(x - 1, y);
      const dy = lum(x, y + 1) - lum(x, y - 1);
      let nx = -dx * strength, ny = -dy * strength, nz = 255;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      odata.data[i] = (nx * 0.5 + 0.5) * 255;
      odata.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      odata.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      odata.data[i + 3] = 255;
    }
  }
  octx.putImageData(odata, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}
