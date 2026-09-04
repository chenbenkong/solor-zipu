import * as THREE from 'three';

// 通用座舱套件：任何飞船都可复用的 FUI 风格驾驶舱
// theme: { accent: 0xffb040, dash: 0x2a2f38, frame: 0x3a3f46 }
export function createCockpitKit(theme = {}) {
  const accent = theme.accent !== undefined ? theme.accent : 0xffb040;
  const dashColor = theme.dash !== undefined ? theme.dash : 0x2a2f38;
  const frameColor = theme.frame !== undefined ? theme.frame : 0x3a3f46;

  const interior = new THREE.Group();
  const consoleGroup = new THREE.Group();
  interior.add(consoleGroup);

  const darkMat = new THREE.MeshStandardMaterial({ color: dashColor, metalness: 0.6, roughness: 0.55 });
  const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, metalness: 0.7, roughness: 0.45 });
  const screenMat = new THREE.MeshBasicMaterial({ color: accent });
  const cyanMat = new THREE.MeshBasicMaterial({ color: theme.secondary !== undefined ? theme.secondary : 0x57e6ff });

  // 仪表台
  const dash = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.52, 0.7), darkMat);
  dash.position.set(0, 0.28, 2.75);
  dash.rotation.x = -0.28;
  consoleGroup.add(dash);

  // 主显示屏
  const mainScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.34), screenMat);
  mainScreen.position.set(0, 0.44, 2.62);
  mainScreen.rotation.x = -0.28;
  consoleGroup.add(mainScreen);

  // 左右多功能屏
  const mfdL = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.3), cyanMat);
  mfdL.position.set(-0.85, 0.42, 2.66);
  mfdL.rotation.x = -0.28;
  consoleGroup.add(mfdL);
  const mfdR = mfdL.clone();
  mfdR.position.x = 0.85;
  consoleGroup.add(mfdR);

  // 操纵杆
  const stickBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.05, 16), darkMat);
  stickBase.position.set(0, 0.32, 2.32);
  consoleGroup.add(stickBase);
  const stickGlowRing = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.016, 8, 24), cyanMat);
  stickGlowRing.position.set(0, 0.35, 2.32);
  stickGlowRing.rotation.x = Math.PI / 2;
  consoleGroup.add(stickGlowRing);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.036, 0.46, 10), new THREE.MeshStandardMaterial({
    color: 0x2a3a48, metalness: 0.85, roughness: 0.3
  }));
  stick.position.set(0, 0.58, 2.34);
  stick.rotation.x = 0.18;
  consoleGroup.add(stick);
  const grip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 12), new THREE.MeshStandardMaterial({
    color: 0x1d2c38, metalness: 0.72, roughness: 0.32
  }));
  grip.position.set(0, 0.8, 2.3);
  consoleGroup.add(grip);

  // 座舱框架拱 + 中柱
  const intArchGeo = new THREE.TorusGeometry(1.28, 0.075, 10, 28, Math.PI);
  const arch1 = new THREE.Mesh(intArchGeo, frameMat);
  arch1.position.set(0, 0.62, 1.15);
  interior.add(arch1);
  const arch2 = new THREE.Mesh(intArchGeo, frameMat);
  arch2.position.set(0, 0.62, -0.1);
  interior.add(arch2);
  const centerStrut = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.35, 0.1), frameMat);
  centerStrut.position.set(0, 1.15, 0.55);
  interior.add(centerStrut);

  // 舱内玻璃罩（第一视角时的舷窗本体）
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x8fb8d8, transparent: true, opacity: 0.12, metalness: 0, roughness: 0.05,
    clearcoat: 1, side: THREE.DoubleSide
  });
  const innerGlass = new THREE.Mesh(new THREE.SphereGeometry(1.5, 36, 22), glassMat);
  innerGlass.scale.set(1.18, 0.95, 2.0);
  innerGlass.position.set(0, 0.8, 1.1);
  innerGlass.renderOrder = 6;
  interior.add(innerGlass);

  // 座舱地板
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 2.6), darkMat);
  floor.position.set(0, 0.05, 1.2);
  consoleGroup.add(floor);

  return { interior, console: consoleGroup, innerGlass };
}

// 引擎喷口径向辉光纹理（共享生成器：外部引用 THREE 仅此处注册一次）
const _glowTexCache = {};
export function createEngineGlowTexture(colorKey = 'cyan') {
  if (_glowTexCache[colorKey]) return _glowTexCache[colorKey];
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  _glowTexCache[colorKey] = tex;
  return tex;
}
