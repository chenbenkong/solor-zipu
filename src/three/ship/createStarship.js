import * as THREE from 'three';

/**
 * 星隼号 ZF-77 —— 原创程序化建模的星球大战风格战机
 * 设计语言致敬 X-wing / TIE 气质：细长机鼻、X 型展开翼、四引擎离子尾焰、
 * 金属机身 + 橙红识别涂装 + 全透明气泡座舱。全部几何体程序化生成，不依赖外部模型。
 *
 * 约定：机头朝 +Z（与 Object3D.lookAt 的朝向约定一致）。
 */

const HULL_COLOR = 0xb9bec6;
const HULL_DARK = 0x43484f;
const ACCENT_ORANGE = 0xd9662a;
const ACCENT_RED = 0xa83232;
const ENGINE_CYAN = 0x6fd8ff;
const ENGINE_AMBER = 0xffb040;

function makeGlowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeHullMaterial(envMap) {
  return new THREE.MeshStandardMaterial({
    color: HULL_COLOR,
    metalness: 0.82,
    roughness: 0.36,
    envMap: envMap || null,
    envMapIntensity: 0.7
  });
}

function makeDarkMaterial(envMap) {
  return new THREE.MeshStandardMaterial({
    color: HULL_DARK,
    metalness: 0.75,
    roughness: 0.5,
    envMap: envMap || null,
    envMapIntensity: 0.5
  });
}

function makeGlassMaterial(envMap) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x9fd2ff,
    metalness: 0,
    roughness: 0.06,
    transparent: true,
    opacity: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMap: envMap || null,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
    depthWrite: false
  });
}

function makePaintMaterial(color, envMap) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.4,
    roughness: 0.45,
    envMap: envMap || null,
    envMapIntensity: 0.6
  });
}

// 确定性伪随机（机身格纹细节不抖动）
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createStarship(envMap) {
  const ship = new THREE.Group();
  ship.name = 'Starship';

  const exterior = new THREE.Group();
  const interior = new THREE.Group();
  ship.add(exterior);
  ship.add(interior);

  const hullMat = makeHullMaterial(envMap);
  const darkMat = makeDarkMaterial(envMap);
  const orangeMat = makePaintMaterial(ACCENT_ORANGE, envMap);
  const redMat = makePaintMaterial(ACCENT_RED, envMap);
  const glassMat = makeGlassMaterial(envMap);
  const emissiveCyan = new THREE.MeshBasicMaterial({ color: ENGINE_CYAN });
  const emissiveAmber = new THREE.MeshBasicMaterial({ color: ENGINE_AMBER });

  const engineGlows = [];   // 引擎喷口发光盘（可随油门改变亮度）
  const engineLights = [];  // 引擎点光源
  const engineTrails = [];  // 离子尾焰（长度随油门）
  const glowTexture = makeGlowTexture('rgba(255,255,255,1)', 'rgba(150,220,255,0.55)');

  /* ---------------- 机身 ---------------- */
  // 机鼻锥：细长尖锐
  const noseGeo = new THREE.CylinderGeometry(0.16, 0.95, 4.4, 14);
  noseGeo.rotateX(Math.PI / 2); // 顶端(+Y) → +Z
  const nose = new THREE.Mesh(noseGeo, hullMat);
  nose.position.set(0, 0.15, 5.4);
  nose.castShadow = true;
  exterior.add(nose);

  // 机鼻传感器环（橙色识别环）
  const ringGeo = new THREE.TorusGeometry(0.98, 0.06, 8, 24);
  const noseRing = new THREE.Mesh(ringGeo, orangeMat);
  noseRing.position.set(0, 0.15, 3.4);
  exterior.add(noseRing);

  // 主机身
  const bodyGeo = new THREE.CylinderGeometry(0.95, 1.25, 5.6, 14);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, hullMat);
  body.position.set(0, 0, 0.6);
  body.castShadow = true;
  exterior.add(body);

  // 机腹装甲板
  const bellyGeo = new THREE.BoxGeometry(1.7, 0.5, 4.6);
  const belly = new THREE.Mesh(bellyGeo, darkMat);
  belly.position.set(0, -0.85, 0.4);
  belly.castShadow = true;
  exterior.add(belly);

  // 机脊背板
  const spineGeo = new THREE.BoxGeometry(1.1, 0.45, 4.2);
  const spine = new THREE.Mesh(spineGeo, darkMat);
  spine.position.set(0, 0.95, 0);
  exterior.add(spine);

  // 机身侧面格纹细节（确定性随机小面板）
  const rand = seeded(20260831);
  const greebleGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Mesh(greebleGeo, rand() > 0.5 ? darkMat : hullMat);
    const side = i % 2 === 0 ? 1 : -1;
    const w = 0.12 + rand() * 0.3;
    const h = 0.08 + rand() * 0.22;
    const d = 0.15 + rand() * 0.5;
    g.scale.set(w, h, d);
    g.position.set(side * (1.16 + rand() * 0.06), -0.35 + rand() * 1.2, -1.8 + rand() * 4.4);
    exterior.add(g);
  }

  // 座舱段：气泡舷窗（外观）
  const canopyGeo = new THREE.SphereGeometry(1.0, 32, 20);
  const canopy = new THREE.Mesh(canopyGeo, glassMat);
  canopy.scale.set(0.92, 0.62, 1.75);
  canopy.position.set(0, 0.78, 1.7);
  canopy.renderOrder = 5;
  exterior.add(canopy);

  // 座舱框架（外观）
  const frameMat = darkMat;
  const canopyFrameGeo = new THREE.TorusGeometry(0.86, 0.055, 8, 24, Math.PI);
  const f1 = new THREE.Mesh(canopyFrameGeo, frameMat);
  f1.position.set(0, 0.72, 2.35);
  exterior.add(f1);
  const f2 = new THREE.Mesh(canopyFrameGeo, frameMat);
  f2.position.set(0, 0.72, 1.05);
  exterior.add(f2);

  // 舷窗周围饰条
  const trimGeo = new THREE.TorusGeometry(0.97, 0.03, 6, 24, Math.PI);
  const trim = new THREE.Mesh(trimGeo, orangeMat);
  trim.position.set(0, 0.74, 1.7);
  exterior.add(trim);

  // 领航机器人穹顶（座舱后方）
  const droidBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.3, 16), darkMat);
  droidBase.position.set(0, 1.05, -0.35);
  exterior.add(droidBase);
  const droidDome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), hullMat);
  droidDome.position.set(0, 1.18, -0.35);
  exterior.add(droidDome);
  const droidEye = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), emissiveCyan);
  droidEye.position.set(0.16, 1.3, -0.12);
  droidEye.rotation.x = -0.5;
  exterior.add(droidEye);

  // 尾部散热格栅
  for (let i = 0; i < 5; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.5), darkMat);
    fin.position.set(-0.7 + i * 0.35, 0.35, -2.45);
    exterior.add(fin);
  }

  // 通讯天线
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), darkMat);
  antenna.position.set(0.45, 1.6, -1.5);
  exterior.add(antenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), emissiveAmber);
  antennaTip.position.set(0.45, 2.25, -1.5);
  exterior.add(antennaTip);

  /* ---------------- X 型四翼 ---------------- */
  const wingSigns = [
    { sy: 1, sz: 1, roll: 0.42, sweep: -0.16 },   // 右上
    { sy: -1, sz: 1, roll: -0.42, sweep: -0.16 }, // 右下
    { sy: 1, sz: -1, roll: -0.42, sweep: 0.16 },  // 左上
    { sy: -1, sz: -1, roll: 0.42, sweep: 0.16 }   // 左下
  ];

  wingSigns.forEach((w, idx) => {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(w.sz * 0.9, 0, -0.9);

    // 翼面：略带锥度
    const wingGeo = new THREE.BoxGeometry(5.4, 0.14, 1.9);
    const wing = new THREE.Mesh(wingGeo, hullMat);
    wing.position.set(w.sz * 2.7, 0, w.sweep * 2.2);
    wing.rotation.y = w.sweep * 0.5;
    wing.castShadow = true;
    wingGroup.add(wing);

    // 翼尖航炮
    const cannonGeo = new THREE.CylinderGeometry(0.07, 0.09, 2.9, 8);
    cannonGeo.rotateX(Math.PI / 2);
    const cannon = new THREE.Mesh(cannonGeo, darkMat);
    cannon.position.set(w.sz * 5.15, 0.12, 0.6 + w.sweep * 2.2);
    wingGroup.add(cannon);
    const cannonTip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), redMat);
    cannonTip.position.set(w.sz * 5.15, 0.12, 2.1 + w.sweep * 2.2);
    wingGroup.add(cannonTip);

    // 翼面红色识别条
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.03, 0.5), redMat);
    stripe.position.set(w.sz * 3.6, 0.09, w.sweep * 2.2);
    wingGroup.add(stripe);
    const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 1.4), redMat);
    stripe2.position.set(w.sz * 4.6, 0.09, w.sweep * 2.2);
    wingGroup.add(stripe2);

    // 翼根连接件
    const root = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 1.5), darkMat);
    root.position.set(w.sz * 0.45, 0, 0);
    wingGroup.add(root);

    // X 型仰角：上翼上扬、下翼下压（左右镜像对称）
    wingGroup.rotation.z = w.sy * w.sz * 0.42;

    ship.add(wingGroup);

    /* ------- 引擎短舱（每翼一台，共四台） ------- */
    const nacelleGeo = new THREE.CylinderGeometry(0.5, 0.56, 2.6, 18);
    nacelleGeo.rotateX(Math.PI / 2);
    const nacelle = new THREE.Mesh(nacelleGeo, hullMat);
    const nx = w.sz * 1.75;
    const ny = w.sy * 0.95;
    nacelle.position.set(nx, ny, -1.7);
    nacelle.castShadow = true;
    ship.add(nacelle);

    // 进气口前环（橙色）
    const intake = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 8, 20), orangeMat);
    intake.position.set(nx, ny, -0.42);
    ship.add(intake);

    // 引擎喷口发光盘
    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), emissiveCyan.clone());
    glowDisc.position.set(nx, ny, -3.02);
    glowDisc.rotation.y = Math.PI; // 面向 -Z（后方观察者）
    ship.add(glowDisc);
    engineGlows.push(glowDisc);

    // 喷口外圈辉光精灵
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: ENGINE_CYAN,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.85
    }));
    glowSprite.scale.set(1.6, 1.6, 1);
    glowSprite.position.set(nx, ny, -3.3);
    ship.add(glowSprite);
    engineGlows.push(glowSprite);

    // 离子尾焰锥（长度随油门伸缩）
    const trailGeo = new THREE.CylinderGeometry(0.52, 0.1, 1, 14, 1, true);
    trailGeo.rotateX(-Math.PI / 2); // 顶(+Y, r=0.52) → -Z 远端
    trailGeo.translate(0, 0, -0.5); // 原点移到喷口处
    const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({
      color: 0x59c8ff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    }));
    trail.position.set(nx, ny, -3.05);
    ship.add(trail);
    engineTrails.push(trail);

    // 引擎点光源（第 1 台带真实光源，其余共享氛围即可）
    if (idx === 0) {
      const eLight = new THREE.PointLight(0x66ccff, 2.2, 26, 2);
      eLight.position.set(0, 0, -3.6);
      ship.add(eLight);
      engineLights.push(eLight);
    }
  });

  /* ---------------- 座舱内饰（第一视角专用） ---------------- */
  const consoleGroup = new THREE.Group();
  interior.add(consoleGroup);

  // 仪表台
  const dash = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.52, 0.7), darkMat);
  dash.position.set(0, 0.28, 2.75);
  dash.rotation.x = -0.28;
  consoleGroup.add(dash);

  // 主显示屏（琥珀色 FUI 风格）
  const mainScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.34), new THREE.MeshBasicMaterial({ color: 0xffb040 }));
  mainScreen.position.set(0, 0.44, 2.62);
  mainScreen.rotation.x = -0.28;
  consoleGroup.add(mainScreen);

  // 左右多功能屏（青色）
  const mfdL = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.3), new THREE.MeshBasicMaterial({ color: 0x57e6ff }));
  mfdL.position.set(-0.85, 0.42, 2.66);
  mfdL.rotation.x = -0.28;
  consoleGroup.add(mfdL);
  const mfdR = mfdL.clone();
  mfdR.position.x = 0.85;
  consoleGroup.add(mfdR);

  // 操纵杆
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 8), darkMat);
  stick.position.set(0, 0.55, 2.35);
  stick.rotation.x = 0.25;
  consoleGroup.add(stick);
  const grip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), redMat);
  grip.position.set(0, 0.8, 2.28);
  consoleGroup.add(grip);

  // 座舱内饰框架拱（透过舷窗可见的边缘结构）
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

  // 内饰玻璃罩（巨大透明舷窗的本体）
  const innerGlassGeo = new THREE.SphereGeometry(1.5, 36, 22);
  const innerGlass = new THREE.Mesh(innerGlassGeo, glassMat);
  innerGlass.scale.set(1.18, 0.95, 2.0);
  innerGlass.position.set(0, 0.8, 1.1);
  innerGlass.renderOrder = 6;
  interior.add(innerGlass);

  // 座舱地板
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 2.6), darkMat);
  floor.position.set(0, 0.05, 1.2);
  consoleGroup.add(floor);

  exterior.traverse(o => { o.frustumCulled = true; });

  return {
    group: ship,
    exterior,
    interior,
    glassMat,
    engineGlows,
    engineLights,
    engineTrails,
    innerGlass,
    console: consoleGroup,
    // 油门 0~1：驱动喷口亮度与尾焰长度
    setThrottle(t) {
      const k = Math.max(0, Math.min(1, t));
      engineGlows.forEach(g => {
        if (g.isSprite) {
          g.material.opacity = 0.35 + k * 0.6;
          const s = 1.2 + k * 1.3;
          g.scale.set(s, s, 1);
        } else {
          g.material.color.setHSL(0.55, 0.9, 0.45 + k * 0.25);
        }
      });
      engineTrails.forEach(tr => {
        tr.scale.z = 0.5 + k * 7.5;
        tr.material.opacity = 0.12 + k * 0.4;
      });
      engineLights.forEach(l => { l.intensity = 0.8 + k * 2.6; });
    }
  };
}
