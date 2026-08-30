import * as THREE from 'three';

export function createPlanetTexture(type) {
  const cvs = document.createElement('canvas');
  const size = 2048;
  cvs.width = size;
  cvs.height = size / 2;
  const ctx = cvs.getContext('2d');

  switch (type) {
    case 'jupiter':
      return createJupiterTexture(ctx, size);
    case 'saturn':
      return createSaturnTexture(ctx, size);
    case 'mars':
      return createMarsTexture(ctx, size);
    case 'venus':
      return createVenusTexture(ctx, size);
    case 'mercury':
      return createMercuryTexture(ctx, size);
    case 'uranus':
      return createUranusTexture(ctx, size);
    case 'neptune':
      return createNeptuneTexture(ctx, size);
    case 'pluto':
      return createPlutoTexture(ctx, size);
    default:
      return new THREE.CanvasTexture(cvs);
  }
}

export function createNormalMap(type) {
  const cvs = document.createElement('canvas');
  const size = 512;
  cvs.width = size;
  cvs.height = size / 2;
  const ctx = cvs.getContext('2d');
  
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, size, size / 2);
  
  const intensity = {
    jupiter: 0.3,
    saturn: 0.2,
    mars: 0.6,
    venus: 0.3,
    mercury: 0.7,
    uranus: 0.2,
    neptune: 0.25,
    pluto: 0.5
  }[type] || 0.3;
  
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * (size / 2);
    const r = 1 + Math.random() * 3;
    
    const dx = (Math.random() - 0.5) * intensity * 50;
    const dy = (Math.random() - 0.5) * intensity * 50;
    
    const rChannel = Math.floor(128 + dx);
    const gChannel = Math.floor(128 + dy);
    
    ctx.fillStyle = `rgb(${rChannel}, ${gChannel}, 255)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  
  return new THREE.CanvasTexture(cvs);
}

function createJupiterTexture(ctx, size) {
  const height = size / 2;
  
  // NASA真实木星颜色 - 更偏黄褐色/米色
  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, '#c9b896');
  baseGradient.addColorStop(0.5, '#c4b291');
  baseGradient.addColorStop(1, '#bfac8c');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, size, height);

  // 木星真实的云带结构 - 暗带(Belts)和亮带(Zones)
  const bands = [
    // 北半球
    { start: 0.01, end: 0.06, color: '#6b5b4f', opacity: 0.75, type: 'belt' },  // 北极暗带
    { start: 0.06, end: 0.12, color: '#d4c9a8', opacity: 0.6, type: 'zone' },   // 北极亮带
    { start: 0.12, end: 0.20, color: '#5a4a3e', opacity: 0.8, type: 'belt' },   // 北温带暗带
    { start: 0.20, end: 0.30, color: '#e0d5b5', opacity: 0.55, type: 'zone' },  // 北温带亮带
    { start: 0.30, end: 0.42, color: '#4a3a2e', opacity: 0.85, type: 'belt' },  // 北热带暗带
    { start: 0.42, end: 0.50, color: '#f0e8d0', opacity: 0.5, type: 'zone' },   // 赤道亮带
    // 赤道区域
    { start: 0.50, end: 0.58, color: '#3a2a1e', opacity: 0.9, type: 'belt' },   // 赤道暗带
    // 南半球
    { start: 0.58, end: 0.68, color: '#e8dcc0', opacity: 0.55, type: 'zone' },  // 南赤道亮带
    { start: 0.68, end: 0.78, color: '#5a4a3e', opacity: 0.8, type: 'belt' },   // 南热带暗带
    { start: 0.78, end: 0.88, color: '#d4c9a8', opacity: 0.6, type: 'zone' },   // 南温带亮带
    { start: 0.88, end: 0.94, color: '#6b5b4f', opacity: 0.75, type: 'belt' },  // 南极暗带
    { start: 0.94, end: 0.99, color: '#c9b896', opacity: 0.5, type: 'zone' }    // 南极亮带
  ];

  bands.forEach(band => {
    const yStart = band.start * height;
    const yEnd = band.end * height;
    
    for (let y = yStart; y < yEnd; y += 1.5) {
      // 更复杂的湍流效果
      const turbulence = Math.sin(y * 0.08) * 4 + Math.sin(y * 0.15) * 2 + Math.sin(y * 0.03) * 3;
      const alpha = band.opacity * (0.85 + Math.sin(y * 0.025) * 0.15);
      
      ctx.fillStyle = hexToRgba(band.color, alpha);
      ctx.fillRect(0, y + turbulence, size, 1.5);
    }
  });

  // 添加更多云团细节
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * height;
    const w = 30 + Math.random() * 120;
    const h = 1.5 + Math.random() * 4;
    
    // 根据位置选择颜色 - 亮带用浅色，暗带用深色
    const isBright = Math.random() > 0.5;
    if (isBright) {
      ctx.fillStyle = `rgba(${220 + Math.random() * 25}, ${200 + Math.random() * 20}, ${160 + Math.random() * 20}, ${0.15 + Math.random() * 0.2})`;
    } else {
      ctx.fillStyle = `rgba(${80 + Math.random() * 30}, ${60 + Math.random() * 25}, ${40 + Math.random() * 20}, ${0.2 + Math.random() * 0.25})`;
    }
    ctx.fillRect(x, y, w, h);
  }

  // 大红斑 (Great Red Spot) - 更真实的颜色
  const grsX = size * 0.75;
  const grsY = height * 0.62;
  const grsRadiusX = size * 0.06;
  const grsRadiusY = height * 0.045;

  const grsGradient = ctx.createRadialGradient(grsX, grsY, 0, grsX, grsY, grsRadiusX);
  grsGradient.addColorStop(0, 'rgba(165, 95, 75, 0.95)');
  grsGradient.addColorStop(0.25, 'rgba(175, 105, 85, 0.9)');
  grsGradient.addColorStop(0.5, 'rgba(155, 85, 65, 0.75)');
  grsGradient.addColorStop(0.75, 'rgba(135, 75, 55, 0.5)');
  grsGradient.addColorStop(1, 'rgba(115, 65, 45, 0)');

  ctx.save();
  ctx.translate(grsX, grsY);
  ctx.rotate(-0.15);
  ctx.beginPath();
  ctx.ellipse(0, 0, grsRadiusX, grsRadiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = grsGradient;
  ctx.fill();
  
  // 大红斑边缘的湍流
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const dist = grsRadiusX * (0.9 + Math.random() * 0.3);
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist * (grsRadiusY / grsRadiusX);
    
    ctx.fillStyle = `rgba(145, 85, 65, ${0.3 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(px, py, 3 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 小白斑 (White Ovals) - 南半球
  for (let i = 0; i < 3; i++) {
    const ox = size * (0.65 + i * 0.04);
    const oy = height * (0.72 + Math.random() * 0.02);
    const or = size * 0.015;
    
    const ovalGradient = ctx.createRadialGradient(ox, oy, 0, ox, oy, or);
    ovalGradient.addColorStop(0, 'rgba(240, 235, 220, 0.8)');
    ovalGradient.addColorStop(0.5, 'rgba(230, 225, 210, 0.6)');
    ovalGradient.addColorStop(1, 'rgba(220, 215, 200, 0)');
    
    ctx.beginPath();
    ctx.ellipse(ox, oy, or, or * 0.7, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = ovalGradient;
    ctx.fill();
  }

  // 添加细微纹理噪点
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * height;
    const r = 0.5 + Math.random() * 2.5;
    
    const noiseType = Math.random();
    if (noiseType > 0.6) {
      // 亮斑
      ctx.fillStyle = `rgba(255, 245, 220, ${0.1 + Math.random() * 0.15})`;
    } else if (noiseType > 0.3) {
      // 中性色
      ctx.fillStyle = `rgba(180, 160, 130, ${0.08 + Math.random() * 0.12})`;
    } else {
      // 暗斑
      ctx.fillStyle = `rgba(90, 70, 50, ${0.1 + Math.random() * 0.15})`;
    }
    
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(ctx.canvas);
}

function createSaturnTexture(ctx, size) {
  const height = size / 2;
  
  // NASA真实土星颜色 - 淡黄色/奶油色基调
  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, '#f5e6c8');
  baseGradient.addColorStop(0.3, '#f0e0c0');
  baseGradient.addColorStop(0.5, '#ebdab8');
  baseGradient.addColorStop(0.7, '#e6d4b0');
  baseGradient.addColorStop(1, '#e0cea8');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, size, height);

  // 土星真实的云带结构 - 比木星更柔和
  const bands = [
    // 北半球
    { start: 0.01, end: 0.08, color: '#d4c4a0', opacity: 0.5, type: 'zone' },   // 北极亮带
    { start: 0.08, end: 0.18, color: '#c9b890', opacity: 0.6, type: 'belt' },   // 北温带暗带
    { start: 0.18, end: 0.30, color: '#e0d4b8', opacity: 0.45, type: 'zone' },  // 北温带亮带
    { start: 0.30, end: 0.42, color: '#c4b488', opacity: 0.65, type: 'belt' },  // 北热带暗带
    { start: 0.42, end: 0.50, color: '#f0e8d8', opacity: 0.4, type: 'zone' },   // 赤道亮带
    // 赤道区域
    { start: 0.50, end: 0.58, color: '#b8a878', opacity: 0.7, type: 'belt' },   // 赤道暗带
    // 南半球
    { start: 0.58, end: 0.70, color: '#ebe0c8', opacity: 0.45, type: 'zone' },  // 南赤道亮带
    { start: 0.70, end: 0.82, color: '#c9b890', opacity: 0.6, type: 'belt' },   // 南热带暗带
    { start: 0.82, end: 0.92, color: '#e0d4b8', opacity: 0.5, type: 'zone' },   // 南温带亮带
    { start: 0.92, end: 0.99, color: '#d4c4a0', opacity: 0.55, type: 'zone' }   // 南极亮带
  ];

  bands.forEach(band => {
    const yStart = band.start * height;
    const yEnd = band.end * height;
    
    for (let y = yStart; y < yEnd; y += 2) {
      // 土星云带更平滑，湍流较少
      const turbulence = Math.sin(y * 0.04) * 2 + Math.sin(y * 0.08) * 1;
      const alpha = band.opacity * (0.9 + Math.sin(y * 0.02) * 0.1);
      
      ctx.fillStyle = hexToRgba(band.color, alpha);
      ctx.fillRect(0, y + turbulence, size, 2);
    }
  });

  // 添加云团细节 - 土星更柔和
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * height;
    const w = 40 + Math.random() * 150;
    const h = 2 + Math.random() * 5;
    
    // 土星颜色更柔和
    const isBright = Math.random() > 0.5;
    if (isBright) {
      ctx.fillStyle = `rgba(${240 + Math.random() * 15}, ${230 + Math.random() * 15}, ${200 + Math.random() * 20}, ${0.12 + Math.random() * 0.15})`;
    } else {
      ctx.fillStyle = `rgba(${160 + Math.random() * 25}, ${145 + Math.random() * 25}, ${110 + Math.random() * 20}, ${0.15 + Math.random() * 0.2})`;
    }
    ctx.fillRect(x, y, w, h);
  }

  // 北极六边形风暴 (Hexagonal Storm) - 土星特有
  const hexX = size * 0.5;
  const hexY = height * 0.08;
  const hexRadius = size * 0.035;

  // 绘制六边形
  ctx.save();
  ctx.translate(hexX, hexY);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const x = hexRadius * Math.cos(angle);
    const y = hexRadius * Math.sin(angle) * 0.6; // 压扁以适应球面投影
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  
  const hexGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, hexRadius);
  hexGradient.addColorStop(0, 'rgba(200, 180, 140, 0.6)');
  hexGradient.addColorStop(0.5, 'rgba(180, 160, 120, 0.4)');
  hexGradient.addColorStop(1, 'rgba(160, 140, 100, 0.2)');
  ctx.fillStyle = hexGradient;
  ctx.fill();
  ctx.strokeStyle = 'rgba(140, 120, 90, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 南极涡旋
  const vortexX = size * 0.5;
  const vortexY = height * 0.92;
  const vortexRadius = size * 0.025;

  const vortexGradient = ctx.createRadialGradient(vortexX, vortexY, 0, vortexX, vortexY, vortexRadius);
  vortexGradient.addColorStop(0, 'rgba(220, 200, 170, 0.5)');
  vortexGradient.addColorStop(0.6, 'rgba(200, 180, 150, 0.3)');
  vortexGradient.addColorStop(1, 'rgba(180, 160, 130, 0)');
  
  ctx.beginPath();
  ctx.ellipse(vortexX, vortexY, vortexRadius, vortexRadius * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = vortexGradient;
  ctx.fill();

  // 添加细微纹理噪点
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * size;
    const y = Math.random() * height;
    const r = 0.8 + Math.random() * 2;
    
    const noiseType = Math.random();
    if (noiseType > 0.6) {
      // 亮斑
      ctx.fillStyle = `rgba(255, 250, 230, ${0.08 + Math.random() * 0.1})`;
    } else if (noiseType > 0.3) {
      // 中性色
      ctx.fillStyle = `rgba(200, 185, 155, ${0.06 + Math.random() * 0.08})`;
    } else {
      // 暗斑
      ctx.fillStyle = `rgba(140, 125, 95, ${0.08 + Math.random() * 0.12})`;
    }
    
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(ctx.canvas);
}

function createMarsTexture(ctx, size) {
  const height = size / 2;
  
  // NASA真实火星颜色 - 铁锈红/橙红色基调
  // 南半球高地（古老、陨石坑多）vs 北半球低地（较平坦）
  const baseGradient = ctx.createLinearGradient(0, 0, size, height);
  baseGradient.addColorStop(0, '#c47050');    // 左上：较亮区域
  baseGradient.addColorStop(0.3, '#b06040'); // 中上：标准红色
  baseGradient.addColorStop(0.5, '#a05035'); // 中间：标准红色
  baseGradient.addColorStop(0.7, '#8a4530'); // 中下：较暗区域
  baseGradient.addColorStop(1, '#753a28');   // 右下：暗区
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, size, height);

  // 南半球高地 - 密集的大型陨石坑（南半球在左边）
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * size * 0.45;
    const y = Math.random() * height;
    const r = 8 + Math.random() * 25;
    
    // 陨石坑效果 - 中心亮，边缘暗
    const craterGradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    craterGradient.addColorStop(0, 'rgba(140, 70, 50, 0.4)');
    craterGradient.addColorStop(0.4, 'rgba(120, 60, 45, 0.5)');
    craterGradient.addColorStop(0.8, 'rgba(100, 50, 40, 0.6)');
    craterGradient.addColorStop(1, 'rgba(90, 45, 35, 0.3)');
    
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = craterGradient;
    ctx.fill();
  }

  // 北半球低地 - 较少的陨石坑，更平坦
  for (let i = 0; i < 60; i++) {
    const x = size * 0.55 + Math.random() * size * 0.45;
    const y = Math.random() * height;
    const r = 5 + Math.random() * 15;
    
    const craterGradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    craterGradient.addColorStop(0, 'rgba(160, 80, 55, 0.3)');
    craterGradient.addColorStop(0.5, 'rgba(140, 70, 50, 0.4)');
    craterGradient.addColorStop(1, 'rgba(120, 60, 45, 0.2)');
    
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = craterGradient;
    ctx.fill();
  }

  // 奥林帕斯山 (Olympus Mons) - 太阳系最大火山
  // 位于北半球西部 (约18°N, 133°W)
  const olympusX = size * 0.63;
  const olympusY = height * 0.36;
  const olympusR = size * 0.045;
  
  const olympusGradient = ctx.createRadialGradient(olympusX, olympusY, 0, olympusX, olympusY, olympusR);
  olympusGradient.addColorStop(0, 'rgba(200, 120, 90, 0.7)');
  olympusGradient.addColorStop(0.3, 'rgba(180, 100, 75, 0.6)');
  olympusGradient.addColorStop(0.6, 'rgba(160, 85, 65, 0.5)');
  olympusGradient.addColorStop(0.85, 'rgba(140, 75, 60, 0.4)');
  olympusGradient.addColorStop(1, 'rgba(120, 65, 55, 0.2)');
  
  ctx.beginPath();
  ctx.arc(olympusX, olympusY, olympusR, 0, Math.PI * 2);
  ctx.fillStyle = olympusGradient;
  ctx.fill();
  
  // 奥林帕斯山悬崖
  ctx.beginPath();
  ctx.arc(olympusX, olympusY, olympusR * 0.95, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(100, 55, 45, 0.3)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 水手号峡谷 (Valles Marineris) - 巨大峡谷系统
  // 位于赤道附近，约4000公里长
  const canyonStartX = size * 0.45;
  const canyonStartY = height * 0.42;
  const canyonLength = size * 0.35;
  const canyonWidth = size * 0.025;
  
  // 主峡谷
  ctx.beginPath();
  ctx.moveTo(canyonStartX, canyonStartY);
  
  // 使用贝塞尔曲线绘制蜿蜒的峡谷
  ctx.bezierCurveTo(
    canyonStartX + canyonLength * 0.3, canyonStartY - height * 0.05,
    canyonStartX + canyonLength * 0.6, canyonStartY + height * 0.08,
    canyonStartX + canyonLength, canyonStartY + height * 0.02
  );
  
  ctx.lineWidth = canyonWidth;
  ctx.strokeStyle = 'rgba(80, 40, 35, 0.6)';
  ctx.stroke();
  
  // 峡谷分支
  for (let i = 0; i < 5; i++) {
    const branchX = canyonStartX + (canyonLength * (0.2 + i * 0.15));
    const branchY = canyonStartY + (Math.random() - 0.5) * height * 0.1;
    const branchLength = size * 0.08;
    
    ctx.beginPath();
    ctx.moveTo(branchX, branchY);
    ctx.lineTo(branchX + branchLength * 0.7, branchY + (Math.random() - 0.5) * height * 0.08);
    ctx.lineWidth = canyonWidth * 0.4;
    ctx.strokeStyle = 'rgba(85, 45, 38, 0.5)';
    ctx.stroke();
  }

  // 塔尔西斯高地 (Tharsis) - 火山高原
  // 位于奥林帕斯山东侧
  const tharsisX = size * 0.72;
  const tharsisY = height * 0.35;
  const tharsisR = size * 0.08;
  
  const tharsisGradient = ctx.createRadialGradient(tharsisX, tharsisY, 0, tharsisX, tharsisY, tharsisR);
  tharsisGradient.addColorStop(0, 'rgba(170, 90, 65, 0.4)');
  tharsisGradient.addColorStop(0.5, 'rgba(150, 80, 60, 0.3)');
  tharsisGradient.addColorStop(1, 'rgba(130, 70, 55, 0.1)');
  
  ctx.beginPath();
  ctx.arc(tharsisX, tharsisY, tharsisR, 0, Math.PI * 2);
  ctx.fillStyle = tharsisGradient;
  ctx.fill();

  // 其他三座大火山（在塔尔西斯高地）
  const volcanoes = [
    { x: 0.68, y: 0.28, r: 0.025 }, // 艾斯克雷尔斯山
    { x: 0.76, y: 0.30, r: 0.022 }, // 帕弗尼斯山
    { x: 0.80, y: 0.38, r: 0.020 }  // 阿尔西亚山
  ];
  
  volcanoes.forEach(volcano => {
    const vx = size * volcano.x;
    const vy = height * volcano.y;
    const vr = size * volcano.r;
    
    const vGradient = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    vGradient.addColorStop(0, 'rgba(190, 105, 75, 0.5)');
    vGradient.addColorStop(0.5, 'rgba(165, 90, 65, 0.4)');
    vGradient.addColorStop(1, 'rgba(140, 75, 55, 0.2)');
    
    ctx.beginPath();
    ctx.arc(vx, vy, vr, 0, Math.PI * 2);
    ctx.fillStyle = vGradient;
    ctx.fill();
  });

  // 表面纹理细节
  for (let i = 0; i < 1000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * height;
    const r = 1 + Math.random() * 4;
    
    const noiseType = Math.random();
    if (noiseType > 0.6) {
      // 亮斑 - 沙尘覆盖区域
      ctx.fillStyle = `rgba(${200 + Math.random() * 30}, ${110 + Math.random() * 25}, ${75 + Math.random() * 20}, ${0.15 + Math.random() * 0.2})`;
    } else if (noiseType > 0.3) {
      // 中性色
      ctx.fillStyle = `rgba(${150 + Math.random() * 25}, ${75 + Math.random() * 20}, ${55 + Math.random() * 15}, ${0.12 + Math.random() * 0.15})`;
    } else {
      // 暗斑 - 岩石暴露区域
      ctx.fillStyle = `rgba(${100 + Math.random() * 20}, ${50 + Math.random() * 15}, ${40 + Math.random() * 12}, ${0.18 + Math.random() * 0.2})`;
    }
    
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 尘暴痕迹 - 暗色条纹
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    const y = Math.random() * height;
    const length = 30 + Math.random() * 100;
    const angle = Math.random() * Math.PI * 2;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.lineWidth = 2 + Math.random() * 4;
    ctx.strokeStyle = `rgba(90, 50, 40, ${0.1 + Math.random() * 0.15})`;
    ctx.stroke();
  }

  // 北极冰盖
  const northGradient = ctx.createLinearGradient(0, 0, 0, height * 0.1);
  northGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  northGradient.addColorStop(0.3, 'rgba(250, 252, 255, 0.7)');
  northGradient.addColorStop(0.6, 'rgba(240, 248, 255, 0.4)');
  northGradient.addColorStop(1, 'rgba(230, 245, 255, 0)');
  ctx.fillStyle = northGradient;
  ctx.fillRect(0, 0, size, height * 0.1);

  // 南极冰盖
  const southGradient = ctx.createLinearGradient(0, height - height * 0.1, 0, height);
  southGradient.addColorStop(0, 'rgba(230, 245, 255, 0)');
  southGradient.addColorStop(0.4, 'rgba(240, 248, 255, 0.4)');
  southGradient.addColorStop(0.7, 'rgba(250, 252, 255, 0.7)');
  southGradient.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
  ctx.fillStyle = southGradient;
  ctx.fillRect(0, height - height * 0.1, size, height * 0.1);

  return new THREE.CanvasTexture(ctx.canvas);
}

function createVenusTexture(ctx, size) {
  const height = size / 2;
  
  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, '#f5d5a0');
  baseGradient.addColorStop(0.5, '#e8c080');
  baseGradient.addColorStop(1, '#dbb060');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, size, height);

  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * height;
    const width = 80 + Math.random() * 200;
    const height2 = 20 + Math.random() * 60;
    const opacity = 0.2 + Math.random() * 0.3;

    const gradient = ctx.createLinearGradient(x, y, x, y + height2);
    gradient.addColorStop(0, `hsla(35, 70%, ${50 + Math.random() * 20}%, ${opacity * 0.3})`);
    gradient.addColorStop(0.5, `hsla(40, 80%, ${60 + Math.random() * 20}%, ${opacity})`);
    gradient.addColorStop(1, `hsla(35, 70%, ${50 + Math.random() * 20}%, ${opacity * 0.3})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height2);
  }

  return new THREE.CanvasTexture(ctx.canvas);
}

function createMercuryTexture(ctx, size) {
  const height = size / 2;
  
  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, '#d8d0c8');
  baseGradient.addColorStop(0.3, '#c8c0b8');
  baseGradient.addColorStop(0.7, '#b8b0a0');
  baseGradient.addColorStop(1, '#a8a090');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, size, height);

  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * height;
    const r = 3 + Math.random() * 15;
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, '#a09088');
    gradient.addColorStop(0.7, '#908078');
    gradient.addColorStop(1, '#c0b8b0');
    
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  return new THREE.CanvasTexture(ctx.canvas);
}

function createUranusTexture(ctx, size) {
  const height = size / 2;
  
  ctx.fillStyle = '#2a6090';
  ctx.fillRect(0, 0, size, height);

  for (let i = 0; i < 20; i++) {
    const bandY = (i * height / 20) + (Math.random() * 10 - 5);
    const bandHeight = 8 + Math.random() * 20;
    const opacity = 0.1 + Math.random() * 0.15;

    const gradient = ctx.createLinearGradient(0, bandY, 0, bandY + bandHeight);
    gradient.addColorStop(0, `hsla(200, 60%, 50%, ${opacity * 0.3})`);
    gradient.addColorStop(0.5, `hsla(210, 70%, 60%, ${opacity})`);
    gradient.addColorStop(1, `hsla(200, 60%, 50%, ${opacity * 0.3})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, bandY, size, bandHeight);
  }

  return new THREE.CanvasTexture(ctx.canvas);
}

function createNeptuneTexture(ctx, size) {
  const height = size / 2;
  
  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, '#1a5a9c');
  baseGradient.addColorStop(1, '#0a3a7c');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, size, height);

  for (let i = 0; i < 15; i++) {
    const yPos = (i / 14) * (height * 0.45) + height * 0.025;
    const h = height * 0.04 + Math.random() * height * 0.06;

    const gradient = ctx.createLinearGradient(0, yPos, 0, yPos + h);
    gradient.addColorStop(0, 'rgba(30, 85, 150, 0.4)');
    gradient.addColorStop(0.5, 'rgba(30, 85, 150, 0.6)');
    gradient.addColorStop(1, 'rgba(30, 85, 150, 0.4)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, yPos, size, h);
  }

  const spotX = size * 0.3;
  const spotY = height * 0.28;
  const spotR = size * 0.12;

  const spotGradient = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotR);
  spotGradient.addColorStop(0, 'rgba(10, 40, 80, 0.9)');
  spotGradient.addColorStop(0.7, 'rgba(10, 40, 80, 0.7)');
  spotGradient.addColorStop(1, 'rgba(10, 40, 80, 0.3)');

  ctx.beginPath();
  ctx.ellipse(spotX, spotY, spotR, spotR * 0.8, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = spotGradient;
  ctx.fill();

  return new THREE.CanvasTexture(ctx.canvas);
}

function createPlutoTexture(ctx, size) {
  const height = size / 2;
  
  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, '#b08060');
  baseGradient.addColorStop(0.3, '#c09070');
  baseGradient.addColorStop(0.5, '#d0a080');
  baseGradient.addColorStop(0.7, '#c09070');
  baseGradient.addColorStop(1, '#e0c0a0');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, size, height);

  const centerX = size * 0.6;
  const centerY = height * 0.4;

  const heartGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 100);
  heartGradient.addColorStop(0, '#f0e8d8');
  heartGradient.addColorStop(0.3, '#e0d8c8');
  heartGradient.addColorStop(0.7, '#d0c8b8');
  heartGradient.addColorStop(1, '#c0b8a8');

  ctx.beginPath();
  ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
  ctx.fillStyle = heartGradient;
  ctx.fill();

  for (let i = 0; i < 100; i++) {
    const x = Math.random() * size;
    const y = Math.random() * height;
    const radius = 3 + Math.random() * 15;

    const craterGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    craterGradient.addColorStop(0, '#604030');
    craterGradient.addColorStop(0.7, '#805040');
    craterGradient.addColorStop(1, '#a07060');

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = craterGradient;
    ctx.fill();
  }

  return new THREE.CanvasTexture(ctx.canvas);
}

function shadeColor(color, percent) {
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);

  R = parseInt(R * (100 + percent) / 100);
  G = parseInt(G * (100 + percent) / 100);
  B = parseInt(B * (100 + percent) / 100);

  R = Math.min(255, Math.max(0, R));
  G = Math.min(255, Math.max(0, G));
  B = Math.min(255, Math.max(0, B));

  const RR = ((R.toString(16).length === 1) ? "0" + R.toString(16) : R.toString(16));
  const GG = ((G.toString(16).length === 1) ? "0" + G.toString(16) : G.toString(16));
  const BB = ((B.toString(16).length === 1) ? "0" + B.toString(16) : B.toString(16));

  return "#" + RR + GG + BB;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
