import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createStarship } from './createStarship.js';
import { createArrowhead, createFrostring, createNightblade, SHIP_VARIANTS } from './createShipVariants.js';
import { collectShipParts, applyExplode, cleanupDetailParts } from './shipDetailParts.js';

const BUILDERS = {
  falcon: createStarship,
  arrowhead: createArrowhead,
  frostring: createFrostring,
  nightblade: createNightblade
};

/**
 * 程序化大理石纹理：象牙白底 + 灰金脉络 + 细微颗粒（value noise fbm）
 * 用于机库地面/展台/墙裙，营造雕刻大理石展厅质感
 */
export function createMarbleTexture(size = 1024, opts = {}) {
  const base = opts.base || [247, 247, 246];
  const vein = opts.vein || [188, 190, 194];
  const seed = opts.seed || 7;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  let s0 = seed;
  const rnd = () => { s0 = (s0 * 16807) % 21483647; return (s0 % 100000) / 100000; };
  // 可平铺 value noise（周期 = grid，保证接缝连续）
  const grid = 8;
  const nt = new Float32Array(grid * grid);
  for (let i = 0; i < nt.length; i++) nt[i] = rnd();
  const noise = (x, y) => {
    const fx = x * grid, fy = y * grid;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const g = (a, b) => nt[(((b % grid) + grid) % grid) * grid + (((a % grid) + grid) % grid)];
    const n00 = g(x0, y0), n10 = g(x0 + 1, y0), n01 = g(x0, y0 + 1), n11 = g(x0 + 1, y0 + 1);
    return n00 + (n10 - n00) * sx + (n01 - n00) * sy + (n00 - n10 - n01 + n11) * sx * sy;
  };
  // 低频湍流：2 个八度即可，让脉络缓慢蜿蜒而非碎裂
  const turb = (x, y) => noise(x, y) * 0.7 + noise(x * 2, y * 2) * 0.3;
  // 暖金次级通道：独立低频场，制造石材温润的深浅分区
  const gold = (x, y) => noise(x * 1.1 + 3.7, y * 1.1 + 9.1);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = px / size, y = py / size;
      // 主脉：正弦条纹受低频湍流扭曲，高幂次锐化 -> 细长蜿蜒的深灰脉
      const t = turb(x * 1.6, y * 1.6);
      const band = Math.sin((x * 2.4 + y * 1.0 + t * 1.5) * Math.PI);
      const main = Math.pow(Math.max(0, -band), 26);
      // 发丝细脉：另一方向的窄丝线，稀疏而淡
      const t2 = turb(x * 2.2 + 5.2, y * 2.2 + 2.7);
      const band2 = Math.sin((x * 1.4 - y * 3.0 + t2 * 1.3) * Math.PI);
      const fine = Math.pow(Math.max(0, -band2), 50) * 0.55;
      // 大块柔和明暗 + 极轻云斑（无颗粒感）
      const shade = (turb(x * 1.5, y * 1.5) - 0.5) * 9 + (gold(x * 3, y * 3) - 0.5) * 4;
      // 暖金晕：沿脉络边缘淡淡渗出，仿卡拉拉暖金包体
      const gv = Math.pow(Math.max(0, -band), 8) * Math.max(0, gold(x * 1.4, y * 1.4) - 0.45) * 0.6;
      const m = Math.min(1, main + fine);
      const i = (py * size + px) * 4;
      img.data[i] = base[0] + (vein[0] - base[0]) * m + shade + gv * 14;
      img.data[i + 1] = base[1] + (vein[1] - base[1]) * m + shade + gv * 9;
      img.data[i + 2] = base[2] + (vein[2] - base[2]) * m + shade - gv * 4;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const tmpV3 = new THREE.Vector3();
const tmpQ3 = new THREE.Quaternion();
const tmpM3 = new THREE.Matrix4();

/**
 * 星舰机库：简约白色超科幻展厅（Apple Store × 星舰装配车间美学）
 * 全视检流程在此完成：
 *  - assembled：组合 360° 环绕展示（自动旋转 + 拖拽轨道）
 *  - exploded ：数百部件爆炸拆解（滑块无级 + 悬停高亮 + 中文标签引导线）
 *  - interior ：舱内第一视角漫游（拖拽环视 + WASD）
 */
export class ShipGarageScene {
  constructor(container) {
    this.container = container;
    this.ship = null;
    this.shipParts = null;
    this.shipId = 'falcon';
    this.mode = 'assembled';
    this._raf = 0;
    this._disposed = false;
    this._clock = new THREE.Clock();

    this.orbit = { theta: 0.8, phi: 1.22, dist: 15, tTheta: 0.8, tPhi: 1.22, tDist: 15 };
    this.autoRotate = true;
    this._dragging = false;

    // 爆炸
    this.explode = 0;
    this.explodeTarget = 0;
    this.partList = [];
    this._detailParts = null;
    this.hovered = null;
    this.highlightMat = new THREE.MeshStandardMaterial({
      color: 0x35c8ff, metalness: 0.35, roughness: 0.25,
      emissive: 0x18a8e8, emissiveIntensity: 0.65
    });
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerActive = false;

    // 舱内漫游
    this.look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 };
    this.walkPos = new THREE.Vector3(0, 0.95, 0.9);
    this.keys = {};
  }

  init() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = this._buildBackdrop();

    this.camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 2000);

    this._buildLighting();
    this._buildFloor();
    this._buildPlatform();
    this._buildWallDetails();

    // 舱内漫游照明（默认隐藏）
    this.cabinLight = new THREE.PointLight(0xffffff, 3.2, 9, 1.4);
    this.cabinLight.position.set(0, 1.3, 1.4);
    this.cabinLight.visible = false;

    // 悬停标签 + 引导线（白色主题）
    this.labelEl = document.createElement('div');
    this.labelEl.className = 'garage-label';
    this.labelEl.style.display = 'none';
    this.lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.lineEl.setAttribute('class', 'garage-lead');
    this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgEl.setAttribute('class', 'garage-svg');
    this.svgEl.appendChild(this.lineEl);
    this.container.appendChild(this.svgEl);
    this.container.appendChild(this.labelEl);

    // 后处理：轻 Bloom，白色环境仅点亮金属高光
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.15, 0.45, 0.95);
    this.composer.addPass(this.bloom);

    this._bindInput();
    window.addEventListener('resize', this._onResize = () => this._resize());
    this._animate();
  }

  /* ---------------- 白色展厅环境 ---------------- */

  _buildBackdrop() {
    // 垂直渐变：顶部冷白 → 地平线亮白 → 底部浅灰
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#c8c9cc');
    g.addColorStop(0.45, '#e8e8e9');
    g.addColorStop(0.55, '#dedee0');
    g.addColorStop(1, '#a9abb0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildLighting() {
    // 半球光：暖石色天光 / 灰岩地光（压低强度，避免刺眼）
    this.scene.add(new THREE.HemisphereLight(0xfdf8f0, 0xa8a8ac, 0.75));
    // 主光：顶部暖白柔光箱
    const key = new THREE.DirectionalLight(0xfff2e2, 1.5);
    key.position.set(6, 14, 8);
    this.scene.add(key);
    // 补光：侧后冷灰，勾勒金属轮廓
    const rim = new THREE.DirectionalLight(0xcfd6de, 0.62);
    rim.position.set(-9, 5, -10);
    this.scene.add(rim);
    // 正面低强度填充，消除死黑
    const fill = new THREE.DirectionalLight(0xf4efe6, 0.3);
    fill.position.set(0, 2, 12);
    this.scene.add(fill);
  }

  _buildFloor() {
    // 大理石地面：程序化脉络纹理，哑光低反光
    const marbleFloor = createMarbleTexture(1024, { seed: 11 });
    marbleFloor.repeat.set(2.2, 2.2);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(60, 96),
      new THREE.MeshStandardMaterial({
        map: marbleFloor, color: 0xeeece6,
        metalness: 0.04, roughness: 0.5
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -6.4;
    this.scene.add(floor);

    // 地面细网格（暖石灰，克制）
    const grid = new THREE.GridHelper(80, 80, 0xb8b4ac, 0xd8d5cf);
    grid.material.transparent = true;
    grid.material.opacity = 0.16;
    grid.position.y = -6.38;
    this.scene.add(grid);

    // 飞船下方柔和接触阴影（径向渐变贴片）
    const sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    const sctx = sc.getContext('2d');
    const sg = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    sg.addColorStop(0, 'rgba(40, 55, 80, 0.34)');
    sg.addColorStop(1, 'rgba(40, 55, 80, 0)');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 11),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -6.34;
    this.scene.add(shadow);
  }

  _buildPlatform() {
    const g = new THREE.Group();
    // 主展台圆盘：整块大理石雕台（纹理 + 哑光）
    const marblePed = createMarbleTexture(512, { seed: 23, base: [248, 247, 245] });
    marblePed.repeat.set(1.6, 1.6);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(6.6, 6.8, 0.22, 96),
      new THREE.MeshStandardMaterial({
        map: marblePed, color: 0xf1efe9,
        metalness: 0.03, roughness: 0.45
      })
    );
    g.add(disc);
    // 青色发光环（科幻点缀，唯一强色）
    const mkRing = (rIn, rOut, opacity) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(rIn, rOut, 128),
        new THREE.MeshBasicMaterial({
          color: 0x35c8ff, transparent: true, opacity,
          side: THREE.DoubleSide, depthWrite: false
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.13;
      g.add(m);
      return m;
    };
    this.ring1 = mkRing(6.42, 6.52, 0.55);
    this.ring2 = mkRing(5.2, 5.24, 0.26);
    // 展台刻度
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.012, i % 6 === 0 ? 0.5 : 0.2),
        new THREE.MeshBasicMaterial({ color: 0x8fa3bd, transparent: true, opacity: 0.7 })
      );
      tick.position.set(Math.cos(a) * 5.95, 0.13, Math.sin(a) * 5.95);
      tick.rotation.y = -a;
      g.add(tick);
    }
    // 三道悬浮全息弧（缓慢反向旋转，白色空间里的动态元素）
    this.holoArcs = [];
    for (let i = 0; i < 3; i++) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(7.6 + i * 1.5, 0.012, 8, 96, Math.PI * (0.32 + i * 0.12)),
        new THREE.MeshBasicMaterial({ color: i === 1 ? 0x9fb6d4 : 0x35c8ff, transparent: true, opacity: 0.5 })
      );
      arc.rotation.x = -Math.PI / 2 + (i - 1) * 0.1;
      arc.position.y = 0.4 + i * 1.1;
      g.add(arc);
      this.holoArcs.push(arc);
    }
    g.position.y = -6.4;
    this.platform = g;
    this.scene.add(g);
  }

  _buildWallDetails() {
    // 背景竖向光带阵列（暗示无限延伸的白色机库墙）
    const bandMat = new THREE.MeshBasicMaterial({ color: 0xd4d6da, transparent: true, opacity: 0.3 });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const band = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 16), bandMat);
      band.position.set(Math.cos(a) * 46, 1.5, Math.sin(a) * 46);
      band.lookAt(0, 1.5, 0);
      this.scene.add(band);
    }
    // 地平线光带（青色细线，强化空间感）
    const horizon = new THREE.Mesh(
      new THREE.TorusGeometry(46, 0.06, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0x35c8ff, transparent: true, opacity: 0.22 })
    );
    horizon.rotation.x = Math.PI / 2;
    horizon.position.y = -6.2;
    this.scene.add(horizon);
  }

  /* ---------------- 飞船装载 / 检视部件收集 ---------------- */

  loadShip(shipId) {
    const builder = BUILDERS[shipId] || BUILDERS.falcon;
    if (this.ship) {
      this.scene.remove(this.ship);
      this._disposeObject(this.ship);
    }
    this.partList = [];
    this.hovered = null;
    this.explode = 0;
    this.explodeTarget = 0;
    this.shipId = shipId;
    const built = builder(null);
    this.ship = built.group;
    this.shipParts = built;
    this.ship.scale.setScalar(0.62);
    this.ship.position.set(0, 1.6, 0);
    this.scene.add(this.ship);
    this.ship.add(this.cabinLight);
    if (built.setThrottle) built.setThrottle(0.18);
    // 爆炸模式需要时再收集部件（避免选型即卡顿）
    if (this.mode === 'exploded') this._ensureParts();
  }

  _ensureParts() {
    if (this.partList.length) return;
    const { partList, detailParts } = collectShipParts(this.ship, this.shipParts);
    this.partList = partList;
    this._detailParts = detailParts;
  }

  _releaseParts() {
    // 先归位原始部件（爆炸位移需撤销），再移除动态细节件
    if (this.partList.length) applyExplode(this.partList, 0);
    cleanupDetailParts(this._detailParts);
    this._detailParts = null;
    this.partList = [];
    this.hovered = null;
  }

  /* ---------------- 模式切换 ---------------- */

  setMode(m) {
    const prev = this.mode;
    this.mode = m;
    this._clearHover();
    if (m === 'assembled') {
      this.explodeTarget = 0;
      this.cabinLight.visible = false;
      this.orbit.tDist = 15;
      this.autoRotate = true;
      if (prev === 'exploded') this._releaseParts();
    } else if (m === 'exploded') {
      this._ensureParts();
      this.explodeTarget = 1;
      this.cabinLight.visible = false;
      this.orbit.tDist = 24;
      this.autoRotate = true;
    } else if (m === 'interior') {
      this.explodeTarget = 0;
      if (prev === 'exploded') this._releaseParts();
      this.cabinLight.visible = true;
      this.look.yaw = this.look.tYaw = Math.PI;
      this.look.pitch = this.look.tPitch = -0.08;
      this.walkPos.set(0, 1.08, 0.55);
    }
  }

  setExplodeFactor(f) {
    this._ensureParts();
    this.explodeTarget = THREE.MathUtils.clamp(f, 0, 1);
  }

  get partCount() { return this.partList.length; }

  /* ---------------- 输入 ---------------- */

  _bindInput() {
    const el = this.renderer.domElement;
    this._down = (e) => {
      this._dragging = true;
      this._lx = e.clientX; this._ly = e.clientY;
      if (this.mode !== 'interior') this.autoRotate = false;
    };
    this._move = (e) => {
      const rect = el.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.pointerActive = true;
      this._clientX = e.clientX - rect.left;
      this._clientY = e.clientY - rect.top;
      if (!this._dragging) return;
      const dx = e.clientX - this._lx;
      const dy = e.clientY - this._ly;
      this._lx = e.clientX; this._ly = e.clientY;
      if (this.mode === 'interior') {
        this.look.tYaw -= dx * 0.004;
        this.look.tPitch = THREE.MathUtils.clamp(this.look.tPitch - dy * 0.003, -1.2, 1.2);
      } else {
        this.orbit.tTheta -= dx * 0.005;
        this.orbit.tPhi = THREE.MathUtils.clamp(this.orbit.tPhi - dy * 0.004, 0.35, 2.3);
      }
    };
    this._up = () => { this._dragging = false; };
    this._wheel = (e) => {
      e.preventDefault();
      if (this.mode === 'interior') return;
      this.orbit.tDist = THREE.MathUtils.clamp(this.orbit.tDist * (1 + e.deltaY * 0.001), 6, 40);
    };
    this._keyDown = (e) => { this.keys[e.code] = true; };
    this._keyUp = (e) => { this.keys[e.code] = false; };
    el.addEventListener('pointerdown', this._down);
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    el.addEventListener('wheel', this._wheel, { passive: false });
    window.addEventListener('keydown', this._keyDown);
    window.addEventListener('keyup', this._keyUp);
  }

  _resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  /* ---------------- 悬停高亮 ---------------- */

  _clearHover() {
    if (this.hovered) {
      this.hovered.mesh.material = this.hovered.origMat;
      this.hovered = null;
      this.labelEl.style.display = 'none';
    }
  }

  _updateHover() {
    if (this.mode !== 'exploded' || !this.pointerActive || this._dragging) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = this.partList.map(p => p.mesh);
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
    if (this.hovered) {
      this.hovered.mesh.getWorldPosition(tmpV3);
      const anchor = tmpV3.clone().project(this.camera);
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ax = (anchor.x * 0.5 + 0.5) * rect.width;
      const ay = (-anchor.y * 0.5 + 0.5) * rect.height;
      const lx = this._clientX + 24;
      const ly = this._clientY - 24;
      this.labelEl.style.left = lx + 'px';
      this.labelEl.style.top = ly + 'px';
      this.lineEl.setAttribute('x1', ax); this.lineEl.setAttribute('y1', ay);
      this.lineEl.setAttribute('x2', lx); this.lineEl.setAttribute('y2', ly);
    }
  }

  /* ---------------- 主循环 ---------------- */

  _animate = () => {
    if (this._disposed) return;
    this._raf = requestAnimationFrame(this._animate);
    const dt = Math.min(this._clock.getDelta(), 0.05);
    const t = this._clock.elapsedTime;

    // 爆炸平滑
    if (Math.abs(this.explode - this.explodeTarget) > 1e-4) {
      this.explode += (this.explodeTarget - this.explode) * Math.min(1, dt * 3.2);
      applyExplode(this.partList, this.explode);
    }

    // 飞船动效：展示自转 + 悬浮；舱内模式姿态回正
    if (this.ship) {
      if (this.mode === 'interior') {
        this.ship.rotation.y += (0 - this.ship.rotation.y) * Math.min(1, dt * 3);
        this.ship.position.y += (1.4 - this.ship.position.y) * Math.min(1, dt * 3);
      } else {
        this.ship.rotation.y += dt * 0.14;
        // 升高量与拆解度平滑联动，部件群居中于画面
        this.ship.position.y = 1.6 + this.explode * 3.4 + Math.sin(t * 0.9) * 0.35;
      }
    }

    // 展台动效
    this.ring1.material.opacity = 0.42 + Math.sin(t * 1.8) * 0.14;
    this.holoArcs.forEach((arc, i) => {
      arc.rotation.z += dt * (i % 2 === 0 ? 0.12 : -0.09);
    });

    // 相机
    if (this.mode === 'interior') {
      this._updateInteriorCamera(dt);
    } else {
      this._updateOrbitCamera(dt);
      this._updateHover();
    }

    this.composer.render();
  };

  _updateOrbitCamera(dt) {
    const o = this.orbit;
    if (this.autoRotate) o.tTheta += dt * 0.1;
    o.theta += (o.tTheta - o.theta) * Math.min(1, dt * 6);
    o.phi += (o.tPhi - o.phi) * Math.min(1, dt * 6);
    o.dist += (o.tDist - o.dist) * Math.min(1, dt * 5);
    const focusY = 1.6 + this.explode * 4.4;
    const sp = Math.sin(o.phi);
    this.camera.position.set(
      o.dist * sp * Math.sin(o.theta),
      focusY + o.dist * Math.cos(o.phi),
      o.dist * sp * Math.cos(o.theta)
    );
    this.camera.lookAt(0, focusY, 0);
  }

  _updateInteriorCamera(dt) {
    const speed = 1.6 * dt;
    const q = this.ship.quaternion;
    const fwd = tmpV3.set(0, 0, 1).applyQuaternion(q).clone();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    if (this.keys['KeyW']) this.walkPos.addScaledVector(fwd, speed);
    if (this.keys['KeyS']) this.walkPos.addScaledVector(fwd, -speed);
    if (this.keys['KeyA']) this.walkPos.addScaledVector(right, -speed);
    if (this.keys['KeyD']) this.walkPos.addScaledVector(right, speed);
    this.walkPos.x = THREE.MathUtils.clamp(this.walkPos.x, -0.8, 0.8);
    this.walkPos.y = THREE.MathUtils.clamp(this.walkPos.y, 0.4, 1.5);
    this.walkPos.z = THREE.MathUtils.clamp(this.walkPos.z, -0.6, 2.6);

    this.look.yaw += (this.look.tYaw - this.look.yaw) * Math.min(1, dt * 10);
    this.look.pitch += (this.look.tPitch - this.look.pitch) * Math.min(1, dt * 10);

    const scale = this.ship.scale.x;
    tmpV3.copy(this.walkPos).multiplyScalar(scale).applyQuaternion(q).add(this.ship.position);
    this.camera.position.copy(tmpV3);
    tmpQ3.setFromEuler(new THREE.Euler(this.look.pitch, this.look.yaw, 0, 'YXZ'));
    tmpQ3.premultiply(q);
    this.camera.quaternion.slerp(tmpQ3, Math.min(1, dt * 14));
    void tmpM3;
  }

  /* ---------------- 资源释放 ---------------- */

  _disposeObject(root) {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  dispose() {
    this._disposed = true;
    cancelAnimationFrame(this._raf);
    const el = this.renderer && this.renderer.domElement;
    if (el) {
      el.removeEventListener('pointerdown', this._down);
      el.removeEventListener('wheel', this._wheel);
    }
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('keydown', this._keyDown);
    window.removeEventListener('keyup', this._keyUp);
    window.removeEventListener('resize', this._onResize);
    this._releaseParts();
    if (this.ship) this._disposeObject(this.ship);
    if (this.composer) this.composer.dispose();
    if (this.svgEl && this.svgEl.parentElement) this.svgEl.parentElement.removeChild(this.svgEl);
    if (this.labelEl && this.labelEl.parentElement) this.labelEl.parentElement.removeChild(this.labelEl);
    if (this.renderer) {
      this.renderer.dispose();
      if (el && el.parentElement) el.parentElement.removeChild(el);
    }
  }
}

export { SHIP_VARIANTS };
