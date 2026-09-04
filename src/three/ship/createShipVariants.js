import * as THREE from 'three';
import { createCockpitKit, createEngineGlowTexture } from './createCockpitKit.js';

/**
 * 多飞船变体：返回与 createStarship 完全一致的接口
 * { group, exterior, interior, glassMat, engineGlows, engineLights,
 *   engineTrails, innerGlass, console, setThrottle }
 * 机库与主场景通过同一接口驱动，实现热切换。
 */

function makeEngineFX(enginePos, color, trails, glows, lights, glowTexture, engineScale = 1) {
  enginePos.forEach((p, idx) => {
    // 喷口发光盘
    const glowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.36 * engineScale, 20),
      new THREE.MeshBasicMaterial({ color })
    );
    glowDisc.position.set(p[0], p[1], p[2]);
    glowDisc.rotation.y = Math.PI;
    glows.push(glowDisc);
    // 辉光精灵
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85
    }));
    glowSprite.scale.set(1.4 * engineScale, 1.4 * engineScale, 1);
    glowSprite.position.set(p[0], p[1], p[2] - 0.25);
    glows.push(glowSprite);
    // 离子尾焰
    const trailGeo = new THREE.CylinderGeometry(0.44 * engineScale, 0.08, 1, 14, 1, true);
    trailGeo.rotateX(-Math.PI / 2);
    trailGeo.translate(0, 0, -0.5);
    const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    trail.position.set(p[0], p[1], p[2] - 0.05);
    trails.push(trail);
    // 首引擎带光源
    if (idx === 0) {
      const eLight = new THREE.PointLight(color, 2.2, 12, 2);
      eLight.position.set(p[0], p[1], p[2] - 0.6);
      lights.push(eLight);
    }
  });
  return { glows, trails, lights };
}

function wrapParts(group, exterior, kit, engineFX, color) {
  const ship = group;
  ship.add(exterior);
  ship.add(kit.interior);
  fx_mount(ship, engineFX);
  return {
    group: ship,
    exterior,
    interior: kit.interior,
    glassMat: null,
    engineGlows: engineFX.glows,
    engineLights: engineFX.lights,
    engineTrails: engineFX.trails,
    innerGlass: kit.innerGlass,
    console: kit.console,
    setThrottle(t) {
      const k = Math.max(0, Math.min(1, t));
      engineFX.glows.forEach(g => {
        if (g.isSprite) {
          g.material.opacity = 0.35 + k * 0.6;
          const s = 1.1 + k * 1.2;
          g.scale.set(s, s, 1);
        } else {
          g.material.color.set(color).multiplyScalar(0.5 + k * 0.7);
        }
      });
      engineFX.trails.forEach(tr => {
        tr.scale.z = 0.5 + k * 7.5;
        tr.material.opacity = 0.12 + k * 0.4;
      });
      engineFX.lights.forEach(l => { l.intensity = 0.8 + k * 2.6; });
    }
  };

  function fx_mount(s, fx) {
    fx.glows.forEach(g => s.add(g));
    fx.trails.forEach(t => s.add(t));
    fx.lights.forEach(l => s.add(l));
  }
}

/* ================= 箭翎号 Arrowhead：长箭形截击机 ================= */
export function createArrowhead(manager) {
  void manager;
  const ship = new THREE.Group();
  const exterior = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({ color: 0xb8bfc8, metalness: 0.85, roughness: 0.32 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x30353e, metalness: 0.75, roughness: 0.5 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x3d4a5c, metalness: 0.8, roughness: 0.4 });
  const cyanMat = new THREE.MeshBasicMaterial({ color: 0x57e6ff });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fd8ff, transparent: true, opacity: 0.32, metalness: 0, roughness: 0.08, clearcoat: 1
  });

  // 主箭体：长菱形机身（前细后粗，头锥超尖）
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 8.5, 8), hullMat);
  fuselage.geometry.rotateX(Math.PI / 2);
  fuselage.position.set(0, 0, -0.6);
  exterior.add(fuselage);
  // 超长头锥
  const noseGeo = new THREE.CylinderGeometry(0.05, 0.42, 3.6, 8);
  noseGeo.rotateX(Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, hullMat);
  nose.position.set(0, 0, 5.4);
  exterior.add(nose);
  // 机身脊线加强筋
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 6.5), accentMat);
  spine.position.set(0, 0.42, -0.6);
  exterior.add(spine);
  // 座舱盖（贴着机身高处）
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), glassMat
  );
  canopy.scale.set(0.9, 0.55, 1.9);
  canopy.position.set(0, 0.42, 1.6);
  exterior.add(canopy);

  // 后掠三角翼（左右两片，薄板 + 展向分段）
  const wingGeo = (() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);            // 翼根前
    shape.lineTo(2.6, -2.4);       // 翼尖（后掠）
    shape.lineTo(2.6, -3.0);
    shape.lineTo(0, -1.6);         // 翼根后
    shape.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false });
    g.rotateX(Math.PI / 2); // 展开到 XZ 平面（形状 Y → -Z？ 需翻转图，先旋转后在装配时对齐）
    return g;
  })();
  [-1, 1].forEach(side => {
    const wing = new THREE.Mesh(wingGeo, hullMat);
    wing.scale.x = side;           // 镜像
    wing.position.set(side * 0.5, -0.05, 0.4);
    exterior.add(wing);
    // 翼尖发光条纹
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 1.1), cyanMat);
    stripe.position.set(side * 2.9, -0.02, -1.9);
    stripe.rotation.y = side * 0.35;
    exterior.add(stripe);
  });
  // 垂尾
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 1.5), accentMat);
  tailFin.position.set(0, 0.55, -3.4);
  tailFin.rotation.x = -0.18;
  exterior.add(tailFin);

  // 引擎组：尾部三联喷口
  const glows = [], trails = [], lights = [];
  const nozzleGeo = new THREE.CylinderGeometry(0.34, 0.42, 0.9, 12);
  nozzleGeo.rotateX(Math.PI / 2);
  [[-0.5, 0, -4.6], [0.5, 0, -4.6], [0, 0.32, -4.4]].forEach(p => {
    const nozzle = new THREE.Mesh(nozzleGeo, darkMat);
    nozzle.position.set(p[0], p[1], p[2]);
    exterior.add(nozzle);
  });
  makeEngineFX([[-0.5, 0, -5.1], [0.5, 0, -5.1], [0, 0.32, -4.95]],
    0x66d8ff, trails, glows, lights, createEngineGlowTexture(), 0.85);

  // 前部传感器 + 机体细节块
  for (let i = 0; i < 10; i++) {
    const g = new THREE.BoxGeometry(0.24 + (i % 3) * 0.1, 0.04, 0.3 + (i % 2) * 0.2);
    const m = new THREE.Mesh(g, i % 2 ? darkMat : accentMat);
    m.position.set(
      (i % 2 ? 1 : -1) * (0.3 + (i % 4) * 0.06),
      -0.3 + (i % 3) * 0.18,
      -3.4 + i * 0.6
    );
    exterior.add(m);
  }

  const kit = createCockpitKit({ accent: 0x57e6ff, secondary: 0xffb040 });
  const result = wrapParts(ship, exterior, kit, { glows, trails, lights }, 0x66d8ff);
  result.cockpitPos = { y: 1.15, z: 1.35 };
  result.viewOffset = { yaw: 0, dist: 14 };
  return result;
}

/* ================= 霜环号 Frostring：碟形巡航舰 ================= */
export function createFrostring(manager) {
  void manager;
  const ship = new THREE.Group();
  const exterior = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({ color: 0xcfd6de, metalness: 0.9, roughness: 0.28 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x353b45, metalness: 0.75, roughness: 0.5 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xa8e0ff, transparent: true, opacity: 0.35, metalness: 0, roughness: 0.06, clearcoat: 1
  });
  const violetMat = new THREE.MeshBasicMaterial({ color: 0xb07cff });

  // 主碟体：双层压扁球叠加，上下微弧
  const discTop = new THREE.Mesh(new THREE.SphereGeometry(2.6, 48, 24), hullMat);
  discTop.scale.set(1, 0.22, 1);
  discTop.position.y = 0.28;
  exterior.add(discTop);
  const discBottom = new THREE.Mesh(new THREE.SphereGeometry(2.4, 48, 24), darkMat);
  discBottom.scale.set(1, 0.2, 1);
  discBottom.position.y = -0.3;
  exterior.add(discBottom);
  // 赤道环带（发光）
  const equator = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.1, 12, 64), violetMat);
  equator.rotation.x = Math.PI / 2;
  exterior.add(equator);
  // 环带节点灯（8 枚）
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), violetMat);
    node.position.set(Math.cos(a) * 2.55, 0, Math.sin(a) * 2.55);
    exterior.add(node);
  }
  // 顶部穹顶座舱
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassMat
  );
  dome.position.set(0, 0.62, 0.55);
  exterior.add(dome);
  const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.32, 24), darkMat);
  domeBase.position.set(0, 0.48, 0.55);
  exterior.add(domeBase);
  // 底部碟心推进器舱
  const bellyHub = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.5, 0.5, 16), darkMat);
  bellyHub.position.set(0, -0.62, 0);
  exterior.add(bellyHub);

  // 引擎组：尾部一对 + 底部三枚（浮航光斑不参与油门尾焰注册，仅尾部进 FX）
  const glows = [], trails = [], lights = [];
  [[-0.9, 0.05, -2.0], [0.9, 0.05, -2.0]].forEach(p => {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.7, 12), darkMat);
    nozzle.geometry.rotateX(Math.PI / 2);
    nozzle.position.set(p[0], p[1], p[2] + 0.3);
    exterior.add(nozzle);
  });
  makeEngineFX([[-0.9, 0.05, -2.15], [0.9, 0.05, -2.15]],
    0xb97cff, trails, glows, lights, createEngineGlowTexture(), 1.0);
  // 底部氛围灯（静态，不进 FX）
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createEngineGlowTexture(), color: 0x66d8ff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55
    }));
    s.scale.setScalar(0.9);
    s.position.set(Math.cos(a) * 1.3, -0.6, Math.sin(a) * 1.3);
    exterior.add(s);
  }
  // 碟面细节环
  const detailRing = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.05, 8, 48), darkMat);
  detailRing.rotation.x = Math.PI / 2;
  detailRing.position.y = 0.14;
  exterior.add(detailRing);

  const kit = createCockpitKit({ accent: 0xb07cff, secondary: 0x57e6ff });
  const result = wrapParts(ship, exterior, kit, { glows, trails, lights }, 0xb97cff);
  result.cockpitPos = { y: 1.15, z: 1.35 };
  return result;
}

/* ================= 夜刃号 Nightblade：掠翼突袭舰 ================= */
export function createNightblade(manager) {
  void manager;
  const ship = new THREE.Group();
  const exterior = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({ color: 0x23262e, metalness: 0.8, roughness: 0.42 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14161c, metalness: 0.7, roughness: 0.55 });
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff4d5a });
  const orangeMat = new THREE.MeshBasicMaterial({ color: 0xff7a3c });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xff8c66, transparent: true, opacity: 0.38, metalness: 0, roughness: 0.06, clearcoat: 1
  });

  // 中央匕首机身（扁棱形）
  const fuseGeo = new THREE.CylinderGeometry(0.5, 0.75, 7.2, 4);
  fuseGeo.rotateX(Math.PI / 2);
  fuseGeo.rotateY(Math.PI / 4);
  const fuse = new THREE.Mesh(fuseGeo, hullMat);
  fuse.position.set(0, 0, -0.5);
  exterior.add(fuse);
  // 长头锥
  const noseGeo = new THREE.CylinderGeometry(0.05, 0.48, 3.2, 4);
  noseGeo.rotateX(Math.PI / 2);
  noseGeo.rotateY(Math.PI / 4);
  const nose = new THREE.Mesh(noseGeo, hullMat);
  nose.position.set(0, 0, 4.6);
  exterior.add(nose);
  // 座舱盖（黑色钻石形）
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
  canopy.scale.set(0.8, 0.5, 1.6);
  canopy.position.set(0, 0.38, 1.3);
  exterior.add(canopy);

  // 宝盒式后掠翼：宽体翼板（每侧两段折角，X-Wing 反演）
  [-1, 1].forEach(side => {
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 2.8), hullMat);
    inner.position.set(side * 1.15, 0, 0.2);
    inner.rotation.z = side * 0.12;
    inner.rotation.y = side * -0.25;
    exterior.add(inner);
    const outer = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 2.2), darkMat);
    outer.position.set(side * 2.75, side * 0.22, -0.5);
    outer.rotation.z = side * 0.38;
    outer.rotation.y = side * -0.5;
    exterior.add(outer);
    // 翼尖折起小翼 + 红色发光条
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 1.0), darkMat);
    tip.position.set(side * 3.7, side * 0.6, -1.2);
    tip.rotation.z = side * 0.2;
    exterior.add(tip);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 1.6), redMat);
    edge.position.set(side * 3.35, side * 0.42, -0.9);
    edge.rotation.z = side * 0.38;
    exterior.add(edge);
    const innerStripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 2.2), orangeMat);
    innerStripe.position.set(side * 1.1, 0.06, 0.2);
    innerStripe.rotation.y = side * -0.25;
    exterior.add(innerStripe);
  });
  // 双垂尾（内收）
  [-1, 1].forEach(side => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 1.6), darkMat);
    fin.position.set(side * 0.75, 0.4, -2.8);
    fin.rotation.x = -0.25;
    fin.rotation.z = side * -0.15;
    exterior.add(fin);
  });

  // 引擎组：尾部双主喷 + 中央辅助
  const glows = [], trails = [], lights = [];
  [[-0.42, 0, -3.9], [0.42, 0, -3.9]].forEach(p => {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.0, 8), darkMat);
    nozzle.geometry.rotateX(Math.PI / 2);
    nozzle.position.set(p[0], p[1], p[2] + 0.4);
    exterior.add(nozzle);
  });
  makeEngineFX([[-0.42, 0, -4.15], [0.42, 0, -4.15]],
    0xff6a4d, trails, glows, lights, createEngineGlowTexture(), 0.95);

  const kit = createCockpitKit({ accent: 0xff4d5a, secondary: 0xff7a3c });
  const result = wrapParts(ship, exterior, kit, { glows, trails, lights }, 0xff6a4d);
  result.cockpitPos = { y: 1.15, z: 1.35 };
  return result;
}

export const SHIP_VARIANTS = [
  {
    id: 'falcon', name: '星隼号', en: 'STARFALCON',
    role: '多域战斗机', color: '#ffc46b',
    desc: '四联引擎 / X 形折叠翼 / 全视野舰桥舷窗，速度·机动·火力均衡的全能机型。'
  },
  {
    id: 'arrowhead', name: '箭翎号', en: 'ARROWHEAD',
    role: '长距截击机', color: '#66d8ff',
    desc: '超尖头锥与后掠三角翼，三联喷口提供更快的直线极速与滑翔稳定性。'
  },
  {
    id: 'frostring', name: '霜环号', en: 'FROSTRING',
    role: '碟形巡航舰', color: '#b07cff',
    desc: '碟形体 + 赤道光环八节点推进，浮航稳定，适合长时间巡航与观赏。'
  },
  {
    id: 'nightblade', name: '夜刃号', en: 'NIGHTBLADE',
    role: '掠翼突袭舰', color: '#ff6a4d',
    desc: '黑曜掠翼与折叠翼尖，红色刃口光条，匕首般的突袭姿态。'
  }
];
