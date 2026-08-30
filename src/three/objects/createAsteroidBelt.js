import * as THREE from 'three';

// 火星与木星之间的小行星带：用 InstancedMesh 一次性绘制大量细小岩石，性能友好
export function createAsteroidBelt(innerRadius = 1000, outerRadius = 1400, count = 8000) {
  const group = new THREE.Group();

  const { albedo, normal } = buildRockTextures(1024);

  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const material = new THREE.MeshStandardMaterial({
    map: albedo,
    normalMap: normal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: 0.95,
    metalness: 0.04,
    flatShading: true
  });

  // 若用户放入真实岩石照片 textures/rock.jpg，则自动升级（当前下载失败则保留程序化）
  new THREE.TextureLoader().load(
    import.meta.env.BASE_URL + 'textures/rock.jpg',
    (tex) => {
      if (tex.image) {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        material.map = tex;
        material.normalMap = buildNormalFromImage(tex.image, 1024);
        material.needsUpdate = true;
      }
    },
    undefined,
    () => { /* 无真实贴图，保持程序化岩石 */ }
  );

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const r = innerRadius + Math.random() * (outerRadius - innerRadius);
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 20;

    dummy.position.set(r * Math.cos(theta), y, r * Math.sin(theta));
    dummy.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    // 尺寸按平方分布：绝大多数极小，少数略大（真实小行星大多<100km，即<0.08）
    const s = 0.02 + Math.pow(Math.random(), 3) * 0.15;
    dummy.scale.set(s, s * (0.6 + Math.random() * 0.8), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    const tone = 0.7 + Math.random() * 0.35;
    const warm = Math.random() * 0.12;
    color.setRGB(tone * (0.95 + warm), tone * 0.9, tone * 0.82);
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);

  return group;
}

function buildRockTextures(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 多倍频值噪声生成基底明暗
  const noise = makeValueNoise(size);
  ctx.fillStyle = '#8a8078';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.6, freq = 4;
      for (let o = 0; o < 4; o++) {
        v += amp * noise(x / size * freq, y / size * freq);
        amp *= 0.5; freq *= 2;
      }
      const shade = 60 + v * 110;
      const i = (y * size + x) * 4;
      const k = (shade - 120) * 0.5;
      d[i] = Math.max(20, Math.min(235, 138 + k));
      d[i + 1] = Math.max(18, Math.min(230, 128 + k));
      d[i + 2] = Math.max(16, Math.min(220, 120 + k));
    }
  }
  ctx.putImageData(img, 0, 0);

  // 陨石坑：暗环 + 亮缘
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 3 + Math.random() * 16;
    ctx.strokeStyle = 'rgba(35,30,26,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(205,200,192,0.22)';
    ctx.beginPath(); ctx.arc(x, y, r * 0.82, 0, Math.PI * 2); ctx.fill();
  }

  // 裂纹（随机游走暗线）
  for (let i = 0; i < 40; i++) {
    let x = Math.random() * size, y = Math.random() * size;
    ctx.strokeStyle = 'rgba(30,26,22,0.35)';
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 6 + Math.floor(Math.random() * 10);
    for (let s = 0; s < steps; s++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;

  const normal = buildNormalFromImage(canvas, size);
  return { albedo, normal };
}

function buildNormalFromImage(src, size) {
  const cw = size, ch = size;
  // src 可能是 canvas 或 image；统一画到 canvas 取像素
  const work = document.createElement('canvas');
  work.width = cw; work.height = ch;
  const wctx = work.getContext('2d');
  wctx.drawImage(src, 0, 0, cw, ch);
  const px = wctx.getImageData(0, 0, cw, ch).data;

  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  const octx = out.getContext('2d');
  const odata = octx.createImageData(cw, ch);
  const lum = (x, y) => {
    const xi = (x + cw) % cw, yi = (y + ch) % ch;
    const i = (yi * cw + xi) * 4;
    return (px[i] + px[i + 1] + px[i + 2]) / 3;
  };
  const strength = 1.8;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const dx = lum(x + 1, y) - lum(x - 1, y);
      const dy = lum(x, y + 1) - lum(x, y - 1);
      let nx = -dx * strength, ny = -dy * strength, nz = 255;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * cw + x) * 4;
      odata.data[i] = (nx * 0.5 + 0.5) * 255;
      odata.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      odata.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      odata.data[i + 3] = 255;
    }
  }
  octx.putImageData(odata, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// 简易值噪声（确定性哈希 + 双线性插值）
function makeValueNoise(size) {
  const grid = 64;
  const r = [];
  for (let i = 0; i < (grid + 1) * (grid + 1); i++) r.push(Math.random());
  const at = (x, y) => r[((y % grid + grid) % grid) * (grid + 1) + ((x % grid + grid) % grid)];
  return (u, v) => {
    const x = u * grid, y = v * grid;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), dd = at(x0 + 1, y0 + 1);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + dd * sx) * sy;
  };
}

// 柯伊伯带：海王星轨道外的冰冻天体带，用 InstancedMesh 3D岩石（非平面贴图）
export function createKuiperBelt(innerRadius = 6500, outerRadius = 7500, count = 3000) {
  const group = new THREE.Group();

  const { albedo, normal } = buildKuiperTextures(1024);

  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const material = new THREE.MeshStandardMaterial({
    map: albedo,
    normalMap: normal,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const r = innerRadius + Math.random() * (outerRadius - innerRadius);
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 30;

    dummy.position.set(r * Math.cos(theta), y, r * Math.sin(theta));
    dummy.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    // 柯伊伯带天体：多数极小，少数略大（冥王星半径1.9，大部分<0.1）
    const s = 0.02 + Math.pow(Math.random(), 3) * 0.18;
    dummy.scale.set(s, s * (0.5 + Math.random() * 1.0), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    // 冰冷的蓝灰色调，偶有微红（甲烷冰）
    const base = 0.65 + Math.random() * 0.3;
    const blueTint = Math.random() * 0.15;
    const redTint = Math.random() * 0.08;
    color.setRGB(
      base * (0.88 + redTint),
      base * (0.90 + blueTint * 0.3),
      base * (0.95 + blueTint)
    );
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);

  return group;
}

// 柯伊伯带冰岩纹理：偏蓝灰冷色调，表面有冰霜质感
function buildKuiperTextures(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const noise = makeValueNoise(size);
  ctx.fillStyle = '#7a8090';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.6, freq = 4;
      for (let o = 0; o < 4; o++) {
        v += amp * noise(x / size * freq, y / size * freq);
        amp *= 0.5; freq *= 2;
      }
      const shade = 55 + v * 120;
      const i = (y * size + x) * 4;
      // 冰冷蓝灰色
      d[i] = Math.max(20, Math.min(220, 110 + shade * 0.3));
      d[i + 1] = Math.max(18, Math.min(225, 118 + shade * 0.35));
      d[i + 2] = Math.max(22, Math.min(235, 130 + shade * 0.4));
    }
  }
  ctx.putImageData(img, 0, 0);

  // 冰霜亮斑
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 10;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(200,210,230,0.35)');
    grd.addColorStop(1, 'rgba(200,210,230,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // 暗色撞击坑
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 3 + Math.random() * 14;
    ctx.strokeStyle = 'rgba(40,45,55,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  }

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;

  const normal = buildNormalFromImage(canvas, size);
  return { albedo, normal };
}
