import * as THREE from 'three';

/**
 * 高真实感卫星贴图生成器 v2 —— canvas 程序化绘制
 * 相比 v1 的单层噪声+色彩渐变，v2 加入：
 *  - 多层域扭曲 fbm（domain warping），产生流状真实地貌
 *  - 几何级陨石坑绘制（带撞击溅射纹、中央峰、边缘明暗），符合月球/木卫三/木卫四真实地貌
 *  - 线状裂纹网络（欧罗巴脊线、土卫二虎纹）用随机游走绘制，非正弦近似
 *  - 火山斑点/熔流（木卫一）用径向渐变 + 周围染色环
 *  - 经纬球面映射校正（极区压缩）
 * 分辨率 1024，配 normalMap 由 moon.js 的 Sobel 流水线生成。
 */

function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

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
    freq *= 2.05;
  }
  return val;
}

// 域扭曲 fbm：地貌流动性大幅提升
function warpedFbm(x, y, octaves, rand, warp = 1.2) {
  const qx = fbm(x + 1.7, y + 9.2, 3, rand);
  const qy = fbm(x + 8.3, y + 2.8, 3, rand);
  return fbm(x + warp * qx, y + warp * qy, octaves, rand);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

// 在 canvas 上绘制一颗陨石坑（球面近似：纬度越高横向越扁）
function drawCrater(ctx, size, cx, cy, r, rand, opts = {}) {
  const { rimLight = 'rgba(255,255,255,0.35)', rimDark = 'rgba(0,0,0,0.4)', floor = 'rgba(0,0,0,0.28)', rays = 0, rayColor = 'rgba(255,255,255,0.5)' } = opts;
  const latScale = 1 / Math.max(0.35, Math.sin((cy / size) * Math.PI)); // 极区横向压缩补偿
  const rx = r * Math.min(2.2, latScale);

  // 溅射纹（先画，在坑缘外侧）
  if (rays > 0) {
    ctx.save();
    for (let i = 0; i < rays; i++) {
      const ang = rand() * Math.PI * 2;
      const len = r * (1.6 + rand() * 2.2);
      ctx.globalAlpha = 0.12 + rand() * 0.15;
      ctx.strokeStyle = rayColor;
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * rx * 0.8, cy + Math.sin(ang) * r * 0.8);
      ctx.lineTo(cx + Math.cos(ang) * rx * 0.8 + Math.cos(ang) * len * latScale, cy + Math.sin(ang) * r * 0.8 + Math.sin(ang) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 坑底
  let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, r));
  g.addColorStop(0, floor);
  g.addColorStop(0.72, 'rgba(0,0,0,0.14)');
  g.addColorStop(0.92, rimDark);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 1.06, r * 1.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // 中央峰（大坑才有）
  if (r > 9 && rand() > 0.4) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = rimLight;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.16, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 边缘高光（光照方向：左上）
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = rimLight;
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, r, 0, Math.PI * 0.95, Math.PI * 1.75);
  ctx.stroke();
  // 边缘阴影（右下）
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = rimDark;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, r, 0, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// 球面均匀采样位置（避免极区过密）
function spherePoints(count, size, rand) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const v = Math.acos(2 * rand() - 1) / Math.PI; // 0..1 均匀纬度
    const u = rand();
    pts.push({ x: u * size, y: v * size, r: v });
  }
  return pts;
}

// 通用基础贴图：域扭曲 fbm 底色
function baseTexture(size, rand, colorFn) {
  const cvs = createCanvas(size, size);
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const [r, g, b] = colorFn(u, v, rand);
      const i = (y * size + x) * 4;
      img.data[i] = clamp(r, 0, 255);
      img.data[i + 1] = clamp(g, 0, 255);
      img.data[i + 2] = clamp(b, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cvs;
}

/**
 * 木卫一 Io —— 硫磺黄橙 + 火山黑斑 + 熔流 + 白霜，无陨石坑（潮汐加热不断翻新地表）
 */
export function generateIoTexture(size = 1024) {
  const rand = mulberry32(42);
  // 底色：低频域扭曲，去掉高频噪点（上一版颗粒感来源）
  const cvs = baseTexture(size, rand, (u, v, rnd) => {
    const n1 = warpedFbm(u * 5.5, v * 5.5, 5, rnd, 1.5);
    const n2 = warpedFbm(u * 10 + 5, v * 10 + 5, 4, rnd, 1.1);

    let r = 218 + n1 * 30;
    let g = 178 + n1 * 26 - n2 * 16;
    let b = 60 + n2 * 18;

    // 大块火山平原（暗色区域，如 Loki 熔湖）
    const volcanic = smoothstep(-0.08, 0.18, n2);
    r = lerp(84, r, volcanic);
    g = lerp(52, g, volcanic);
    b = lerp(30, b, volcanic);
    return [r, g, b];
  });
  const ctx = cvs.getContext('2d');

  // 白霜高地：柔和乳白斑块（二氧化硫霜），先画霜再画火山（火山压在霜上）
  const randF = mulberry32(424);
  spherePoints(15, size, randF).forEach(pt => {
    const r0 = size * (0.03 + randF() * 0.055);
    const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r0);
    g.addColorStop(0, 'rgba(248,246,235,0.5)');
    g.addColorStop(0.6, 'rgba(244,238,220,0.28)');
    g.addColorStop(1, 'rgba(244,238,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r0, 0, Math.PI * 2);
    ctx.fill();
  });

  // 火山口：黑心 + 红热环 + 橙溅射；带 1-2 条锥形熔流（沿曲线、宽度渐减）
  const rand2 = mulberry32(4242);
  const spots = spherePoints(24, size, rand2);
  spots.forEach(pt => {
    const r = 5 + rand2() * 12;
    const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
    g.addColorStop(0, 'rgba(35,10,6,0.95)');
    g.addColorStop(0.4, 'rgba(145,48,16,0.7)');
    g.addColorStop(0.75, 'rgba(210,115,42,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();

    // 熔流：沿随机游走路径画渐细的圆珠链（比直线 stroke 更像熔岩扇）
    if (rand2() > 0.45) {
      const flows = 1 + (rand2() > 0.7 ? 1 : 0);
      for (let f = 0; f < flows; f++) {
        let fx = pt.x, fy = pt.y;
        let ang = rand2() * Math.PI * 2;
        const steps = 10 + Math.floor(rand2() * 12);
        let rad = r * 0.42;
        for (let sIdx = 0; sIdx < steps; sIdx++) {
          ang += (rand2() - 0.5) * 0.5;
          fx += Math.cos(ang) * (r * 0.28);
          fy += Math.sin(ang) * (r * 0.28);
          rad *= 0.93;
          const heat = sIdx / steps;
          ctx.fillStyle = `rgba(${Math.round(200 - heat * 120)},${Math.round(90 - heat * 55)},${Math.round(30 - heat * 18)},${0.55 - heat * 0.35})`;
          ctx.beginPath();
          ctx.arc(fx, fy, Math.max(0.8, rad), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
  return new THREE.CanvasTexture(cvs);
}

/**
 * 木卫二 Europa —— 亮冰面 + 线状裂纹网（Lineae），裂纹随机游走绘制
 */
export function generateEuropaTexture(size = 1024) {
  const rand = mulberry32(77);
  const cvs = baseTexture(size, rand, (u, v, rnd) => {
    const n1 = warpedFbm(u * 6, v * 6, 5, rnd, 1.0);
    const n2 = fbm(u * 16 + 8, v * 16 + 8, 4, rnd);
    let r = 218 + n1 * 18;
    let g = 224 + n1 * 14;
    let b = 235 + n1 * 12;
    const terrain = smoothstep(-0.25, 0.3, n2);
    r = lerp(198, r, terrain);
    g = lerp(205, g, terrain);
    b = lerp(220, b, terrain);
    return [r, g, b];
  });
  const ctx = cvs.getContext('2d');

  // 裂纹网：随机游走脊线，双色（深棕主脊 + 浅棕细纹）
  const rand2 = mulberry32(777);
  ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const wide = i < 18;
    let x = rand2() * size;
    let y = rand2() * size;
    let ang = rand2() * Math.PI * 2;
    const segs = 40 + rand2() * 60;
    ctx.strokeStyle = wide ? 'rgba(150,72,40,0.55)' : 'rgba(170,105,70,0.35)';
    ctx.lineWidth = wide ? 2.2 + rand2() * 2.4 : 0.8 + rand2() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < segs; s++) {
      ang += (rand2() - 0.5) * 0.85;
      const step = 6 + rand2() * 12;
      x = (x + Math.cos(ang) * step + size) % size;
      y = (y + Math.sin(ang) * step + size) % size;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return new THREE.CanvasTexture(cvs);
}

/**
 * 木卫三 Ganymede —— 双色地貌（亮沟槽区 + 暗撞击平原）+ 大量陨石坑
 */
export function generateGanymedeTexture(size = 1024) {
  const rand = mulberry32(123);
  const cvs = baseTexture(size, rand, (u, v, rnd) => {
    const n1 = warpedFbm(u * 6, v * 6, 6, rnd, 1.5);
    const n2 = warpedFbm(u * 12 + 20, v * 12 + 20, 5, rnd, 1.1);
    let r = 150 + n1 * 28;
    let g = 140 + n1 * 24;
    let b = 125 + n1 * 20;
    // sulcus（沟槽亮带）
    const sulcus = smoothstep(0.12, 0.38, n2);
    r = lerp(r, 192, sulcus * 0.55);
    g = lerp(g, 182, sulcus * 0.55);
    b = lerp(b, 168, sulcus * 0.5);
    // dark terrain
    const dark = smoothstep(0.0, 0.25, -n2);
    r = lerp(r, 92, dark * 0.55);
    g = lerp(g, 84, dark * 0.55);
    b = lerp(b, 74, dark * 0.5);
    return [r, g, b];
  });
  const ctx = cvs.getContext('2d');
  const rand2 = mulberry32(1234);
  // 沟槽细纹（grooves）：长平行细线簇
  for (let c = 0; c < 14; c++) {
    let x = rand2() * size, y = rand2() * size;
    const ang = rand2() * Math.PI;
    const lines = 5 + rand2() * 10;
    const len = 60 + rand2() * 140;
    ctx.strokeStyle = 'rgba(205,195,178,0.28)';
    ctx.lineWidth = 1.2;
    for (let l = 0; l < lines; l++) {
      const off = (l - lines / 2) * 5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang + Math.PI / 2) * off, y + Math.sin(ang + Math.PI / 2) * off);
      ctx.lineTo(x + Math.cos(ang) * len + Math.cos(ang + Math.PI / 2) * off, y + Math.sin(ang) * len + Math.sin(ang + Math.PI / 2) * off);
      ctx.stroke();
    }
  }
  // 陨石坑
  const craters = spherePoints(130, size, rand2);
  craters.forEach(pt => {
    drawCrater(ctx, size, pt.x, pt.y, 2 + rand2() * 13, rand2, { rays: rand2() > 0.85 ? 7 : 0 });
  });
  return new THREE.CanvasTexture(cvs);
}

/**
 * 木卫四 Callisto —— 太阳系最密集陨石坑表面，暗底 + 亮溅射大坑（Valhalla 风格）
 */
export function generateCallistoTexture(size = 1024) {
  const rand = mulberry32(256);
  const cvs = baseTexture(size, rand, (u, v, rnd) => {
    const n1 = warpedFbm(u * 7, v * 7, 6, rnd, 1.3);
    const n2 = fbm(u * 22 + 30, v * 22 + 30, 4, rnd);
    let r = 68 + n1 * 22;
    let g = 60 + n1 * 18;
    let b = 52 + n1 * 15;
    const ice = smoothstep(0.45, 0.68, fbm(u * 9 + 80, v * 9 + 80, 2, rnd));
    r = lerp(r, 165, ice * 0.3);
    g = lerp(g, 172, ice * 0.3);
    b = lerp(b, 185, ice * 0.35);
    const bright = smoothstep(0.3, 0.55, n2);
    r = lerp(r, 120, bright * 0.35);
    g = lerp(g, 114, bright * 0.35);
    b = lerp(b, 106, bright * 0.35);
    return [r, g, b];
  });
  const ctx = cvs.getContext('2d');
  const rand2 = mulberry32(256256);
  // 密集陨石坑（四层：巨坑带长溅射纹、中坑、小坑、微亮坑点）
  spherePoints(26, size, rand2).forEach(pt => {
    drawCrater(ctx, size, pt.x, pt.y, 16 + rand2() * 26, rand2, {
      rays: 14, rayColor: 'rgba(245,240,228,0.65)',
      floor: 'rgba(0,0,0,0.4)', rimLight: 'rgba(255,252,244,0.5)'
    });
  });
  spherePoints(95, size, rand2).forEach(pt => {
    drawCrater(ctx, size, pt.x, pt.y, 5 + rand2() * 12, rand2, {
      rays: rand2() > 0.45 ? 8 : 0, rayColor: 'rgba(240,234,220,0.5)',
      floor: 'rgba(0,0,0,0.34)', rimLight: 'rgba(255,250,240,0.42)'
    });
  });
  spherePoints(330, size, rand2).forEach(pt => {
    drawCrater(ctx, size, pt.x, pt.y, 1.5 + rand2() * 4.5, rand2);
  });
  // 新鲜亮坑微点（卡里斯托标志性的密集白点）
  spherePoints(220, size, rand2).forEach(pt => {
    ctx.fillStyle = 'rgba(235,230,218,' + (0.25 + rand2() * 0.3).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 0.7 + rand2() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  });
  return new THREE.CanvasTexture(cvs);
}

/**
 * 土卫六 Titan —— 均匀浓橙雾（几乎无地貌），细微高层雾流
 */
export function generateTitanTexture(size = 1024) {
  const rand = mulberry32(333);
  const cvs = baseTexture(size, rand, (u, v, rnd) => {
    const n1 = warpedFbm(u * 5, v * 5, 5, rnd, 0.8);
    const n2 = fbm(u * 9 + 15, v * 9 + 15, 4, rnd);
    let r = 212 + n1 * 26;
    let g = 152 + n1 * 22 + n2 * 12;
    let b = 52 + n2 * 26;
    const lat = Math.abs(v - 0.5) * 2;
    const band = smoothstep(0.25, 0.6, lat);
    r = lerp(r, 182, band * 0.32);
    g = lerp(g, 122, band * 0.32);
    b = lerp(b, 42, band * 0.32);
    const haze = smoothstep(0.0, 0.55, n1);
    r = lerp(r, 232, haze * 0.22);
    g = lerp(g, 178, haze * 0.2);
    b = lerp(b, 72, haze * 0.14);
    return [r, g, b];
  });
  return new THREE.CanvasTexture(cvs);
}

/**
 * 土卫二 Enceladus —— 纯净亮冰 + 南极虎纹（蓝绿裂缝）+ 微凹地形
 */
export function generateEnceladusTexture(size = 1024) {
  const rand = mulberry32(512);
  const cvs = baseTexture(size, rand, (u, v, rnd) => {
    const n1 = warpedFbm(u * 6, v * 6, 5, rnd, 0.9);
    const n2 = fbm(u * 14 + 10, v * 14 + 10, 4, rnd);
    let r = 236 + n1 * 14;
    let g = 240 + n1 * 11;
    let b = 244 + n1 * 9;
    const terrain = smoothstep(-0.2, 0.22, n2);
    r = lerp(216, r, terrain);
    g = lerp(220, g, terrain);
    b = lerp(226, b, terrain);
    return [r, g, b];
  });
  const ctx = cvs.getContext('2d');
  // 虎纹：南极区（v > 0.72）四条平行主裂缝，随机游走
  const rand2 = mulberry32(512512);
  for (let i = 0; i < 5; i++) {
    let x = size * (0.2 + i * 0.15) + rand2() * 40;
    let y = size * (0.74 + rand2() * 0.05);
    let ang = Math.PI / 2 + (rand2() - 0.5) * 0.5;
    ctx.strokeStyle = 'rgba(90,150,200,0.5)';
    ctx.lineWidth = 3 + rand2() * 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 30; s++) {
      ang += (rand2() - 0.5) * 0.4;
      x = (x + Math.cos(ang) * 10 + size) % size;
      y += Math.sin(ang) * 8;
      if (y > size) break;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // 少量细小坑
  spherePoints(40, size, rand2).forEach(pt => {
    drawCrater(ctx, size, pt.x, pt.y, 1.5 + rand2() * 4, rand2);
  });
  return new THREE.CanvasTexture(cvs);
}

/**
 * 映射卫星名 → 生成器
 */
export const MOON_TEXTURE_GENERATORS = {
  '木卫一（伊奥）': generateIoTexture,
  '木卫二（欧罗巴）': generateEuropaTexture,
  '木卫三（盖尼米德）': generateGanymedeTexture,
  '木卫四（卡里斯托）': generateCallistoTexture,
  '土卫六（泰坦）': generateTitanTexture,
  '土卫二（恩克拉多斯）': generateEnceladusTexture,
  '月球': null, // 月球使用 moon.jpg 真实贴图
};
