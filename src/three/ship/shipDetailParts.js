import * as THREE from 'three';

/**
 * 飞船细节部件共享模块
 * 从 ShipInspector 提取：运行时收集全部 Mesh 部件 + 程序化扩充细节件 +
 * 计算爆炸向量（基于飞船局部坐标，与飞船世界位置无关）。
 * 供机库（白色展厅）与太空检视系统复用。
 */

const tmpV1 = new THREE.Vector3();

// 确定性伪随机
export function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 21483647;
    return (s % 100000) / 100000;
  };
}

/**
 * 收集飞船全部部件并扩充细节件
 * @param {THREE.Group} ship 飞船根节点
 * @param {object} parts { exterior, interior, console, innerGlass }
 * @returns {{ partList: Array, detailParts: Array }}
 */
export function collectShipParts(ship, parts) {
  const partList = [];
  const detailParts = [];
  const rand = seeded(77001);
  const center = new THREE.Vector3();

  // 1) 收集现有 Mesh（排除标记 noExplode 的特效件）
  const existing = [];
  ship.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.noExplode) return;
    existing.push(o);
  });

  // 现有部件命名启发式
  const counters = {};
  const nameOf = (mesh) => {
    const p = mesh.getWorldPosition(tmpV1.set(0, 0, 0)).clone();
    const lp = ship.worldToLocal(p.clone());
    const t = mesh.geometry.type;
    let base = null;
    if (mesh === parts.innerGlass) base = '舱体透明舷窗';
    else if (t === 'TorusGeometry') base = lp.y > 1.5 ? '传感器环' : (lp.z > 0.5 ? '座舱框架拱' : '引擎进气环');
    else if (t === 'SphereGeometry') base = lp.y > 1.0 ? '领航机器人穹顶' : '气泡舷窗';
    else if (t === 'CircleGeometry') base = '引擎喷口发光盘';
    else if (t === 'CylinderGeometry') {
      base = lp.z > 4 ? '机鼻锥' : (lp.z < -1 && Math.abs(lp.x) > 1 ? '引擎短舱' : (lp.y > 1.4 ? '通讯天线' : '液压管路'));
    }
    else if (t === 'BoxGeometry') {
      if (Math.abs(lp.x) > 2) base = '翼面结构';
      else if (lp.y < -0.6) base = '机腹装甲板';
      else if (lp.y > 0.8) base = '机脊背板';
      else base = '机身格纹面板';
    }
    else if (t === 'PlaneGeometry') base = '多功能显示屏';
    if (!base) base = '结构组件';
    counters[base] = (counters[base] || 0) + 1;
    return `${base} ${String(counters[base]).padStart(2, '0')}`;
  };

  const registerPart = (mesh, name) => {
    mesh.userData.partName = name;
    partList.push({
      mesh,
      name,
      homePos: mesh.position.clone(),
      homeQuat: mesh.quaternion.clone(),
      dirLocal: new THREE.Vector3(),
      dist: 3,
      origMat: mesh.material
    });
  };

  existing.forEach(mesh => registerPart(mesh, nameOf(mesh)));

  // 2) 程序化扩充细节件（管线/螺栓/散热片/涡轮环/装甲片）至数百件
  const hullLike = new THREE.MeshStandardMaterial({ color: 0x8f959e, metalness: 0.8, roughness: 0.42 });
  const darkLike = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.7, roughness: 0.5 });
  const pipeLike = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.85, roughness: 0.35 });

  const addDetail = (geo, mat, pos, rot, name, parent) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.userData.inspDetail = true;
    (parent || parts.exterior).add(m);
    detailParts.push(m);
    registerPart(m, name);
    return m;
  };

  // 机身管线
  for (let i = 0; i < 24; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const len = 1.2 + rand() * 2.6;
    const geo = new THREE.CylinderGeometry(0.035 + rand() * 0.03, 0.035, len, 8);
    geo.rotateX(Math.PI / 2);
    addDetail(geo, pipeLike,
      new THREE.Vector3(side * (1.05 + rand() * 0.25), -0.55 + rand() * 1.1, -1.6 + rand() * 3.4),
      [0, 0, 0], `机身管线 ${String(i + 1).padStart(2, '0')}`);
  }
  // 机身螺栓群
  const boltGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6);
  for (let i = 0; i < 40; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    addDetail(boltGeo, darkLike,
      new THREE.Vector3(side * (1.18 + rand() * 0.05), -0.5 + rand() * 1.4, -2.2 + rand() * 5),
      [0, 0, Math.PI / 2], `紧固螺栓 ${String(i + 1).padStart(2, '0')}`);
  }
  // 机腹散热片阵列
  for (let i = 0; i < 18; i++) {
    const geo = new THREE.BoxGeometry(0.05, 0.16, 0.5 + rand() * 0.4);
    addDetail(geo, darkLike,
      new THREE.Vector3(-0.7 + (i % 9) * 0.18, -1.12, -0.8 + Math.floor(i / 9) * 1.4),
      [0, 0, 0], `机腹散热片 ${String(i + 1).padStart(2, '0')}`);
  }
  // 引擎涡轮环 + 喷口螺栓 + 外挂件
  const nacellePos = [[1.75, 0.95], [1.75, -0.95], [-1.75, 0.95], [-1.75, -0.95]];
  nacellePos.forEach((np, ei) => {
    for (let r = 0; r < 5; r++) {
      const geo = new THREE.TorusGeometry(0.5 - r * 0.07, 0.025, 6, 20);
      addDetail(geo, hullLike,
        new THREE.Vector3(np[0], np[1], -0.8 - r * 0.45),
        [0, 0, 0], `E${ei + 1} 涡轮环 ${r + 1}`);
    }
    for (let b = 0; b < 8; b++) {
      const a = (b / 8) * Math.PI * 2;
      addDetail(boltGeo, darkLike,
        new THREE.Vector3(np[0] + Math.cos(a) * 0.55, np[1] + Math.sin(a) * 0.55, -2.95),
        [Math.PI / 2, 0, 0], `E${ei + 1} 喷口螺栓 ${b + 1}`);
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      const geo = new THREE.BoxGeometry(0.1, 0.1, 1.1 + rand() * 0.6);
      addDetail(geo, darkLike,
        new THREE.Vector3(np[0] + Math.cos(a) * 0.56, np[1] + Math.sin(a) * 0.56, -1.5),
        [0, 0, 0], `E${ei + 1} 外挂组件 ${k + 1}`);
    }
  });
  // 翼面装甲片
  const wingSigns = [
    { sy: 1, sz: 1 }, { sy: -1, sz: 1 }, { sy: 1, sz: -1 }, { sy: -1, sz: -1 }
  ];
  wingSigns.forEach((w, wi) => {
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.BoxGeometry(0.5 + rand() * 0.5, 0.03, 0.35 + rand() * 0.4);
      addDetail(geo, i % 3 === 0 ? darkLike : hullLike,
        new THREE.Vector3(w.sz * (1.6 + rand() * 3.4), w.sy * 0.09, -0.9 + (rand() - 0.5) * 1.2),
        [0, 0, w.sy * w.sz * 0.42], `W${wi + 1} 翼面装甲 ${String(i + 1).padStart(2, '0')}`);
    }
  });
  // 舱内细节：座椅/侧控制台/舱顶管线
  addDetail(new THREE.BoxGeometry(0.6, 0.7, 0.5), darkLike, new THREE.Vector3(0, 0.5, 0.6), [0, 0, 0], '飞行员座椅', parts.interior);
  const sideConsoleParent = parts.console || parts.interior;
  addDetail(new THREE.BoxGeometry(0.16, 0.5, 1.4), darkLike, new THREE.Vector3(-0.8, 0.5, 1.6), [0, 0, 0], '左侧控制台', sideConsoleParent);
  addDetail(new THREE.BoxGeometry(0.16, 0.5, 1.4), darkLike, new THREE.Vector3(0.8, 0.5, 1.6), [0, 0, 0], '右侧控制台', sideConsoleParent);
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6);
    geo.rotateX(Math.PI / 2);
    addDetail(geo, pipeLike,
      new THREE.Vector3(-0.6 + i * 0.17, 1.55, 0.8),
      [0, 0, 0], `舱顶管线 ${i + 1}`, parts.interior);
  }

  // 3) 计算爆炸向量：基于飞船局部坐标
  ship.updateWorldMatrix(true, true);
  partList.forEach(pt => {
    const wp = pt.mesh.getWorldPosition(new THREE.Vector3());
    const lp = ship.worldToLocal(wp.clone());
    const dirW = lp.clone().sub(center);
    if (dirW.lengthSq() < 1e-4) dirW.set(0, 1, 0);
    dirW.normalize();
    dirW.x += (rand() - 0.5) * 0.5;
    dirW.y += (rand() - 0.5) * 0.5;
    dirW.z += (rand() - 0.5) * 0.5;
    dirW.normalize();
    const parentInv = new THREE.Quaternion();
    pt.mesh.parent.getWorldQuaternion(parentInv).invert();
    pt.dirLocal = dirW.applyQuaternion(parentInv);
    // 径向外扩 + 沿主结构轴分层：疏朗通透
    const radialBoost = 3.4 + rand() * 5.2;
    const layerBoost = lp.length() * 1.5;
    pt.dist = radialBoost + layerBoost;
  });

  return { partList, detailParts };
}

/** 按爆炸系数 f（0~1）位移全部部件 */
export function applyExplode(partList, f) {
  const e = f * f * (3 - 2 * f); // smoothstep
  for (const pt of partList) {
    pt.mesh.position.copy(pt.homePos).addScaledVector(pt.dirLocal, pt.dist * e);
  }
}

/** 移除动态添加的细节件（退出/换舰时调用） */
export function cleanupDetailParts(detailParts) {
  if (!detailParts) return;
  detailParts.forEach(m => { if (m.parent) m.parent.remove(m); });
}
