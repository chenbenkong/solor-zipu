import * as THREE from 'three';

/**
 * 星隼号细节检视系统（ShipInspector）
 * 顶级工程可视化交互：
 *  - assembled：组合态 360° 全息展示（自动环绕 + 拖拽轨道 + 全息平台）
 *  - exploded ：数百部件爆炸图（爆炸度滑块 + 悬停高亮 + 中文命名 + 引导线标签）
 *  - interior ：舱内第一视角漫游（拖拽环视 + WASD 移动）
 * 运行时遍历收集全部 Mesh 部件并程序化扩充细节件，不改动原建模代码。
 */

const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();
const tmpQ1 = new THREE.Quaternion();
const tmpM1 = new THREE.Matrix4();

// 确定性伪随机
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 21483647;
    return (s % 100000) / 100000;
  };
}

export class ShipInspector {
  constructor(shipSystem) {
    this.ss = shipSystem;
    this.scene = shipSystem.scene;
    this.camera = shipSystem.camera;
    this.ship = shipSystem.ship;
    this.parts = shipSystem.shipParts;
    this.dom = shipSystem.renderer.domElement;

    this.active = false;
    this.mode = 'assembled';

    // 轨道相机参数（球坐标）
    this.orbit = { theta: 0.6, phi: 1.15, dist: 26, targetTheta: 0.6, targetPhi: 1.15, targetDist: 26 };
    this.autoRotate = true;

    // 爆炸
    this.explodeTarget = 0;   // 0~1 目标
    this.explode = 0;         // 平滑当前值

    // 舱内漫游
    this.look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 };
    this.walkPos = new THREE.Vector3(0, 0.85, 1.4);
    this.keys = {};

    this.partList = [];       // { mesh, name, home: {pos, quat}, dir, dist, baseScale }
    this.hovered = null;
    this.highlightMat = new THREE.MeshStandardMaterial({
      color: 0xffc46b, metalness: 0.4, roughness: 0.3,
      emissive: 0xff9d3c, emissiveIntensity: 0.9
    });

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerActive = false;

    // 舱内照明灯（漫游模式启用）
    this.cabinLight = new THREE.PointLight(0xcfe0ff, 2.6, 7, 1.6);
    this.cabinLight.position.set(0, 1.3, 1.4);
    this.cabinLight.visible = false;
    this.ship.add(this.cabinLight);

    // 全息展示平台
    this.platform = this._buildPlatform();
    this.platform.visible = false;
    this.scene.add(this.platform);

    // HTML 标签 + SVG 引导线
    this.labelEl = document.createElement('div');
    this.labelEl.className = 'insp-label';
    this.labelEl.style.display = 'none';
    this.lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.lineEl.setAttribute('class', 'insp-lead');
    this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgEl.setAttribute('class', 'insp-svg');
    this.svgEl.appendChild(this.lineEl);
    this._domAttached = false;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this.dragging = false;
    this.lastX = 0; this.lastY = 0;
  }

  /* ---------------- 部件收集与扩充 ---------------- */

  _collectParts() {
    this.partList = [];
    const rand = seeded(77001);
    const ship = this.ship;
    const center = new THREE.Vector3();

    // 1) 收集现有 Mesh（排除尾焰/辉光精灵等特效件）
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
      const g = mesh.geometry;
      const t = g.type;
      let base = null;
      if (mesh === this.parts.innerGlass) base = '舱体透明舷窗';
      else if (t === 'TorusGeometry') base = lp.y > 1.5 ? '传感器环' : (lp.z > 0.5 ? '座舱框架拱' : '引擎进气环');
      else if (t === 'SphereGeometry') base = lp.y > 1.0 ? '领航机器人穹顶' : '气泡舷窗';
      else if (t === 'CircleGeometry') base = '引擎喷口发光盘';
      else if (t === 'CylinderGeometry') {
        base = lp.z > 4 ? '机鼻锥' : (lp.z < -1 && Math.abs(lp.x) > 1 ? '引擎短舱' : (lp.y > 1.4 ? '通讯天线' : '液压管路'));
      }
      else if (t === 'BoxGeometry') {
        const s = mesh.scale;
        if (Math.abs(lp.x) > 2) base = '翼面结构';
        else if (lp.y < -0.6) base = '机腹装甲板';
        else if (lp.y > 0.8) base = '机脊背板';
        else base = '机身格纹面板';
        void s;
      }
      else if (t === 'PlaneGeometry') base = '多功能显示屏';
      if (!base) base = '结构组件';
      counters[base] = (counters[base] || 0) + 1;
      return `${base} ${String(counters[base]).padStart(2, '0')}`;
    };

    existing.forEach(mesh => this._registerPart(mesh, nameOf(mesh), rand));

    // 2) 程序化扩充细节件（管线/螺栓/散热片/涡轮环/装甲片）至数百件
    const detailMat = this.parts.exterior.children[0]?.material || null;
    const hullLike = new THREE.MeshStandardMaterial({ color: 0x8f959e, metalness: 0.8, roughness: 0.42 });
    const darkLike = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.7, roughness: 0.5 });
    const pipeLike = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.85, roughness: 0.35 });

    const addDetail = (geo, mat, pos, rot, name, parent) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      m.userData.inspDetail = true;
      (parent || this.parts.exterior).add(m);
      this._registerPart(m, name, rand);
      return m;
    };

    // 机身管线（沿机身两侧纵向排布）
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
    // 引擎涡轮环 + 喷口螺栓（每引擎 6+8）
    const nacellePos = [
      [1.75, 0.95], [1.75, -0.95], [-1.75, 0.95], [-1.75, -0.95]
    ];
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
      // 引擎外挂件
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        const geo = new THREE.BoxGeometry(0.1, 0.1, 1.1 + rand() * 0.6);
        addDetail(geo, darkLike,
          new THREE.Vector3(np[0] + Math.cos(a) * 0.56, np[1] + Math.sin(a) * 0.56, -1.5),
          [0, 0, 0], `E${ei + 1} 外挂组件 ${k + 1}`);
      }
    });
    // 翼面装甲片与铆钉线
    const wingSigns = [
      { sy: 1, sz: 1 }, { sy: -1, sz: 1 }, { sy: 1, sz: -1 }, { sy: -1, sz: -1 }
    ];
    wingSigns.forEach((w, wi) => {
      for (let i = 0; i < 10; i++) {
        const geo = new THREE.BoxGeometry(0.5 + rand() * 0.5, 0.03, 0.35 + rand() * 0.4);
        const m = addDetail(geo, i % 3 === 0 ? darkLike : hullLike,
          new THREE.Vector3(w.sz * (1.6 + rand() * 3.4), w.sy * 0.09, -0.9 + (rand() - 0.5) * 1.2),
          [0, 0, w.sy * w.sz * 0.42], `W${wi + 1} 翼面装甲 ${String(i + 1).padStart(2, '0')}`);
        void m;
      }
    });
    // 舱内细节：座椅/侧控制台/顶部管线
    addDetail(new THREE.BoxGeometry(0.6, 0.7, 0.5), darkLike, new THREE.Vector3(0, 0.5, 0.6), [0, 0, 0], '飞行员座椅', this.parts.interior);
    addDetail(new THREE.BoxGeometry(0.16, 0.5, 1.4), darkLike, new THREE.Vector3(-0.8, 0.5, 1.6), [0, 0, 0], '左侧控制台', this.parts.interior);
    addDetail(new THREE.BoxGeometry(0.16, 0.5, 1.4), darkLike, new THREE.Vector3(0.8, 0.5, 1.6), [0, 0, 0], '右侧控制台', this.parts.interior);
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6);
      geo.rotateX(Math.PI / 2);
      addDetail(geo, pipeLike,
        new THREE.Vector3(-0.6 + i * 0.17, 1.55, 0.8),
        [0, 0, 0], `舱顶管线 ${i + 1}`, this.parts.interior);
    }

    // 计算爆炸向量：基于飞船局部坐标（与飞船世界位置无关）
    ship.updateWorldMatrix(true, true);
    this.partList.forEach(pt => {
      const wp = pt.mesh.getWorldPosition(new THREE.Vector3());
      const lp = ship.worldToLocal(wp.clone()); // 飞船局部坐标
      const dirW = lp.clone().sub(center);
      if (dirW.lengthSq() < 1e-4) dirW.set(0, 1, 0);
      dirW.normalize();
      // 加随机扰动让爆炸更自然
      dirW.x += (rand() - 0.5) * 0.5;
      dirW.y += (rand() - 0.5) * 0.5;
      dirW.z += (rand() - 0.5) * 0.5;
      dirW.normalize();
      // 世界方向 → 父级局部方向
      const parentInv = new THREE.Quaternion();
      pt.mesh.parent.getWorldQuaternion(parentInv).invert();
      pt.dirLocal = dirW.applyQuaternion(parentInv);
      // 爆炸距离基于局部尺寸：部件离船心越远飞得越远
      pt.dist = 1.6 + rand() * 2.2 + lp.length() * 0.55;
    });

    void detailMat;
    return this.partList.length;
  }

  _registerPart(mesh, name, rand) {
    mesh.userData.partName = name;
    this.partList.push({
      mesh,
      name,
      homePos: mesh.position.clone(),
      homeQuat: mesh.quaternion.clone(),
      dirLocal: new THREE.Vector3(),
      dist: 3,
      origMat: mesh.material
    });
    void rand;
  }

  /* ---------------- 全息展示平台 ---------------- */

  _buildPlatform() {
    const g = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffb454, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const ring1 = new THREE.Mesh(new THREE.RingGeometry(5.6, 5.8, 96), ringMat);
    ring1.rotation.x = -Math.PI / 2;
    g.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(4.5, 4.58, 96), ringMat.clone());
    ring2.material.opacity = 0.28;
    ring2.rotation.x = -Math.PI / 2;
    g.add(ring2);
    // 极坐标网格
    const polar = new THREE.PolarGridHelper(5.6, 12, 6, 64, 0x3a4a6a, 0x22304a);
    polar.material.transparent = true;
    polar.material.opacity = 0.35;
    g.add(polar);
    // 刻度标记
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, i % 6 === 0 ? 0.9 : 0.4), ringMat.clone());
      tick.material.opacity = 0.6;
      tick.position.set(Math.cos(a) * 5.15, 0, Math.sin(a) * 5.15);
      tick.rotation.y = -a;
      g.add(tick);
    }
    g.userData.ring1 = ring1;
    g.userData.ring2 = ring2;
    return g;
  }

  /* ---------------- 进入 / 退出 ---------------- */

  enter() {
    if (this.active) return;
    this.active = true;
    this._collectParts();

    // 飞船姿态平滑回正（展示用）
    this.ss.shipState.quaternion.identity();

    // 相机初始：船侧前方
    const wp = this.ship.getWorldPosition(new THREE.Vector3());
    this.orbit.target = wp.clone();
    this.orbit.theta = 0.7; this.orbit.phi = 1.2; this.orbit.dist = 13;
    this.orbit.targetTheta = 0.7; this.orbit.targetPhi = 1.2; this.orbit.targetDist = 13;
    this.autoRotate = true;
    this.explode = 0; this.explodeTarget = 0;

    // 平台放置于船下方
    this.platform.position.copy(wp).add(tmpV1.set(0, -3.2, 0));
    this.platform.visible = true;

    // 事件绑定
    this.dom.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    this.dom.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    // DOM 标签挂载
    if (!this._domAttached) {
      const host = this.dom.parentElement || document.body;
      host.appendChild(this.svgEl);
      host.appendChild(this.labelEl);
      this._domAttached = true;
    }

    this.setMode('assembled');
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this._clearHover();
    // 部件归位
    this.explode = 0; this.explodeTarget = 0;
    this._applyExplode(0);
    this.platform.visible = false;
    this.cabinLight.visible = false;
    this.labelEl.style.display = 'none';

    this.dom.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    this.dom.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  setMode(m) {
    this.mode = m;
    this._clearHover();
    if (m === 'exploded') {
      this.explodeTarget = 1;
      this.platform.visible = true;
      this.orbit.targetDist = 20;
      this.cabinLight.visible = false;
    } else if (m === 'assembled') {
      this.cabinLight.visible = false;
      this.explodeTarget = 0;
      this.platform.visible = true;
      this.orbit.targetDist = 13;
    } else if (m === 'interior') {
      this.explodeTarget = 0;
      this.platform.visible = false;
      this.cabinLight.visible = true;
      this.look.yaw = this.look.tYaw = Math.PI;
      this.look.pitch = this.look.tPitch = -0.08;
      this.walkPos.set(0, 0.95, 0.9);
    }
  }

  setExplodeFactor(f) {
    this.explodeTarget = THREE.MathUtils.clamp(f, 0, 1);
  }

  /* ---------------- 输入 ---------------- */

  _onPointerDown(e) {
    this.dragging = true;
    this.lastX = e.clientX; this.lastY = e.clientY;
    if (this.mode !== 'interior') this.autoRotate = false;
  }
  _onPointerMove(e) {
    // 指针位置（悬停检测）
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.pointerActive = true;
    this._clientX = e.clientX; this._clientY = e.clientY;

    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX; this.lastY = e.clientY;
    if (this.mode === 'interior') {
      this.look.tYaw -= dx * 0.004;
      this.look.tPitch = THREE.MathUtils.clamp(this.look.tPitch - dy * 0.003, -1.2, 1.2);
    } else {
      this.orbit.targetTheta -= dx * 0.005;
      this.orbit.targetPhi = THREE.MathUtils.clamp(this.orbit.targetPhi - dy * 0.004, 0.25, 2.6);
    }
  }
  _onPointerUp() { this.dragging = false; }
  _onWheel(e) {
    e.preventDefault();
    if (this.mode === 'interior') return;
    this.orbit.targetDist = THREE.MathUtils.clamp(this.orbit.targetDist * (1 + e.deltaY * 0.001), 5, 40);
  }
  _onKeyDown(e) { this.keys[e.code] = true; }
  _onKeyUp(e) { this.keys[e.code] = false; }

  /* ---------------- 悬停高亮 ---------------- */

  _clearHover() {
    if (this.hovered) {
      this.hovered.mesh.material = this.hovered.origMat;
      this.hovered = null;
      this.labelEl.style.display = 'none';
    }
  }

  _updateHover() {
    if (this.mode === 'interior' || !this.pointerActive || this.dragging) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [];
    for (const pt of this.partList) meshes.push(pt.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    const hit = hits.length ? this.partList.find(p => p.mesh === hits[0].object) : null;
    if (hit !== this.hovered) {
      this._clearHover();
      if (hit) {
        hit.mesh.material = this.highlightMat;
        this.hovered = hit;
        this.labelEl.textContent = hit.name;
        this.labelEl.style.display = 'block';
      }
    }
    // 标签跟随 + 引导线
    if (this.hovered) {
      this.hovered.mesh.getWorldPosition(tmpV1);
      const anchor = tmpV1.clone().project(this.camera);
      const ax = (anchor.x * 0.5 + 0.5) * window.innerWidth;
      const ay = (-anchor.y * 0.5 + 0.5) * window.innerHeight;
      const lx = this._clientX + 26;
      const ly = this._clientY - 26;
      this.labelEl.style.left = lx + 'px';
      this.labelEl.style.top = ly + 'px';
      this.lineEl.setAttribute('x1', ax); this.lineEl.setAttribute('y1', ay);
      this.lineEl.setAttribute('x2', lx); this.lineEl.setAttribute('y2', ly);
    }
  }

  /* ---------------- 爆炸应用 ---------------- */

  _applyExplode(f) {
    const e = f * f * (3 - 2 * f); // smoothstep
    for (const pt of this.partList) {
      pt.mesh.position.copy(pt.homePos).addScaledVector(pt.dirLocal, pt.dist * e);
    }
  }

  /* ---------------- 主更新 ---------------- */

  update(dt) {
    if (!this.active) return;
    const ship = this.ship;
    const wp = ship.getWorldPosition(tmpV1.set(0, 0, 0)).clone();

    // 爆炸平滑
    if (Math.abs(this.explode - this.explodeTarget) > 1e-4) {
      this.explode += (this.explodeTarget - this.explode) * Math.min(1, dt * 3.2);
      this._applyExplode(this.explode);
    }

    // 平台旋转动效
    if (this.platform.visible) {
      this.platform.userData.ring1.rotation.z += dt * 0.25;
      this.platform.userData.ring2.rotation.z -= dt * 0.4;
      this.platform.position.copy(wp).add(tmpV2.set(0, -3.2 - this.explode * 2, 0));
    }

    if (this.mode === 'interior') {
      this._updateInteriorCamera(dt);
    } else {
      this._updateOrbitCamera(dt, wp);
      this._updateHover();
    }
  }

  _updateOrbitCamera(dt, wp) {
    if (this.autoRotate) this.orbit.targetTheta += dt * 0.12;
    const o = this.orbit;
    o.theta += (o.targetTheta - o.theta) * Math.min(1, dt * 8);
    o.phi += (o.targetPhi - o.phi) * Math.min(1, dt * 8);
    o.dist += (o.targetDist - o.dist) * Math.min(1, dt * 6);
    const sp = Math.sin(o.phi), cp = Math.cos(o.phi);
    tmpV2.set(
      wp.x + o.dist * sp * Math.sin(o.theta),
      wp.y + o.dist * cp,
      wp.z + o.dist * sp * Math.cos(o.theta)
    );
    this.camera.position.copy(tmpV2);
    tmpM1.lookAt(this.camera.position, wp, tmpV3.set(0, 1, 0));
    tmpQ1.setFromRotationMatrix(tmpM1);
    this.camera.quaternion.slerp(tmpQ1, Math.min(1, dt * 12));
  }

  _updateInteriorCamera(dt) {
    // WASD 舱内移动（限制范围）
    const speed = 1.6 * dt;
    const q = this.ship.quaternion;
    const fwd = tmpV1.set(0, 0, 1).applyQuaternion(q);
    const right = tmpV2.set(1, 0, 0).applyQuaternion(q);
    if (this.keys['KeyW']) this.walkPos.addScaledVector(fwd, speed);
    if (this.keys['KeyS']) this.walkPos.addScaledVector(fwd, -speed);
    if (this.keys['KeyA']) this.walkPos.addScaledVector(right, -speed);
    if (this.keys['KeyD']) this.walkPos.addScaledVector(right, speed);
    // 舱内活动范围约束（局部坐标）
    this.walkPos.x = THREE.MathUtils.clamp(this.walkPos.x, -0.8, 0.8);
    this.walkPos.y = THREE.MathUtils.clamp(this.walkPos.y, 0.4, 1.5);
    this.walkPos.z = THREE.MathUtils.clamp(this.walkPos.z, -0.6, 2.6);

    this.look.yaw += (this.look.tYaw - this.look.yaw) * Math.min(1, dt * 10);
    this.look.pitch += (this.look.tPitch - this.look.pitch) * Math.min(1, dt * 10);

    // 局部 → 世界（乘飞船缩放）
    const scale = this.ship.scale.x;
    tmpV3.copy(this.walkPos).multiplyScalar(scale).applyQuaternion(q).add(this.ship.position);
    this.camera.position.copy(tmpV3);

    tmpQ1.setFromEuler(new THREE.Euler(this.look.pitch, this.look.yaw, 0, 'YXZ'));
    tmpQ1.premultiply(q);
    this.camera.quaternion.slerp(tmpQ1, Math.min(1, dt * 14));
  }

  get partCount() { return this.partList.length; }
}
