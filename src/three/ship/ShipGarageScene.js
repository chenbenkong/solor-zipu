import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createStarship } from './createStarship.js';
import { createArrowhead, createFrostring, createNightblade, SHIP_VARIANTS } from './createShipVariants.js';

const BUILDERS = {
  falcon: createStarship,
  arrowhead: createArrowhead,
  frostring: createFrostring,
  nightblade: createNightblade
};

/**
 * 星舰机库（独立展示空间）
 * 简约超空间：深空星云背景 + 全息展台 + 顶部光柱 + 飞船悬浮自转
 * 独立于主场景的渲染器，进入时接管全屏，退出时彻底释放。
 */
export class ShipGarageScene {
  constructor(container) {
    this.container = container;
    this.ship = null;
    this.shipParts = null;
    this._raf = 0;
    this._disposed = false;
    this._clock = new THREE.Clock();
    this.orbit = { theta: 0.8, phi: 1.25, dist: 17, tTheta: 0.8, tPhi: 1.25, tDist: 17 };
    this.autoRotate = true;
    this._dragging = false;
  }

  init() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05070f, 0.008);
    this._buildBackground();

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 2000);
    this.camera.position.set(10, 6, 14);

    // 灯光：顶部主光柱 + 双向补光 + 底部氛围光
    const keyLight = new THREE.SpotLight(0xfff2dd, 60, 60, 0.5, 0.5, 1.4);
    keyLight.position.set(0, 15, 0);
    this.scene.add(keyLight);
    const fillL = new THREE.PointLight(0x6ea8ff, 18, 40, 1.6);
    fillL.position.set(-10, 3, 6);
    this.scene.add(fillL);
    const fillR = new THREE.PointLight(0xff9d5c, 12, 40, 1.6);
    fillR.position.set(10, 2, -6);
    this.scene.add(fillR);
    this.scene.add(new THREE.AmbientLight(0x33405c, 2.2));

    this._buildPlatform();

    // 后处理：Bloom 让引擎辉光与展台光环发光
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.55, 0.72);
    this.composer.addPass(this.bloom);

    this._bindInput();
    window.addEventListener('resize', this._onResize = () => this._resize());
    this._animate();
  }

  /* ---------------- 深空背景 ---------------- */

  _buildBackground() {
    // 星点
    const count = 2600;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 400 + Math.random() * 500;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const t = Math.random();
      col[i * 3] = 0.6 + t * 0.4;
      col[i * 3 + 1] = 0.65 + t * 0.3;
      col[i * 3 + 2] = 0.85 + t * 0.15;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.6, vertexColors: true, sizeAttenuation: false, transparent: true, opacity: 0.85
    }));
    this.scene.add(this.stars);

    // 氛围星云精灵（大范围柔光）
    const mkBlob = (color, x, y, z, scale, opacity) => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(c);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color, transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      sp.scale.setScalar(scale);
      sp.position.set(x, y, z);
      this.scene.add(sp);
    };
    mkBlob(0x2a4a8a, -160, 40, -220, 260, 0.16);
    mkBlob(0x5c2a7a, 180, -30, -180, 220, 0.14);
    mkBlob(0x1a5a6a, 40, -80, 200, 200, 0.12);
  }

  /* ---------------- 全息展台 ---------------- */

  _buildPlatform() {
    const g = new THREE.Group();
    const mkRing = (rIn, rOut, color, opacity) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(rIn, rOut, 96),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        })
      );
      m.rotation.x = -Math.PI / 2;
      g.add(m);
      return m;
    };
    this.ring1 = mkRing(7.4, 7.65, 0xffb454, 0.55);
    this.ring2 = mkRing(6.2, 6.3, 0xffb454, 0.3);
    this.ring3 = mkRing(9.2, 9.26, 0x6ea8ff, 0.18);
    // 极坐标网格
    const polar = new THREE.PolarGridHelper(7.4, 12, 6, 64, 0x4a5a7a, 0x2a3448);
    polar.material.transparent = true;
    polar.material.opacity = 0.3;
    g.add(polar);
    // 顶部光锥（全息光束）
    const beamGeo = new THREE.CylinderGeometry(0.4, 7.2, 15, 32, 1, true);
    beamGeo.translate(0, 7.5, 0);
    this.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: 0xffc46b, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    g.add(this.beam);
    // 数据环刻度
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.02, i % 9 === 0 ? 0.7 : 0.32),
        new THREE.MeshBasicMaterial({ color: 0xffb454, transparent: true, opacity: 0.5 })
      );
      tick.position.set(Math.cos(a) * 6.9, 0, Math.sin(a) * 6.9);
      tick.rotation.y = -a;
      g.add(tick);
    }
    g.position.y = -6.2;
    this.platform = g;
    this.scene.add(g);
  }

  /* ---------------- 飞船装载/切换 ---------------- */

  loadShip(shipId) {
    const builder = BUILDERS[shipId] || BUILDERS.falcon;
    if (this.ship) {
      this.scene.remove(this.ship);
      this._disposeObject(this.ship);
    }
    const built = builder(null);
    this.ship = built.group;
    this.shipParts = built;
    // 机库展示比例：略大于主场景
    this.ship.scale.setScalar(0.62);
    this.ship.position.set(0, 0, 0);
    this.ship.rotation.set(0, 0, 0);
    this.scene.add(this.ship);
    if (built.setThrottle) built.setThrottle(0.22); // 展示油门：引擎微亮、尾焰短促
  }

  /* ---------------- 输入：拖拽环绕 + 滚轮缩放 ---------------- */

  _bindInput() {
    const el = this.renderer.domElement;
    this._down = (e) => { this._dragging = true; this._lx = e.clientX; this._ly = e.clientY; this.autoRotate = false; };
    this._move = (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lx;
      const dy = e.clientY - this._ly;
      this._lx = e.clientX; this._ly = e.clientY;
      this.orbit.tTheta -= dx * 0.005;
      this.orbit.tPhi = THREE.MathUtils.clamp(this.orbit.tPhi - dy * 0.004, 0.5, 2.2);
    };
    this._up = () => { this._dragging = false; };
    this._wheel = (e) => {
      e.preventDefault();
      this.orbit.tDist = THREE.MathUtils.clamp(this.orbit.tDist * (1 + e.deltaY * 0.001), 9, 34);
    };
    el.addEventListener('pointerdown', this._down);
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    el.addEventListener('wheel', this._wheel, { passive: false });
  }

  _resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  /* ---------------- 主循环 ---------------- */

  _animate = () => {
    if (this._disposed) return;
    this._raf = requestAnimationFrame(this._animate);
    const dt = Math.min(this._clock.getDelta(), 0.05);
    const t = this._clock.elapsedTime;

    // 飞船悬浮 + 缓慢自转
    if (this.ship) {
      this.ship.position.y = 1.6 + Math.sin(t * 0.9) * 0.35;
      this.ship.rotation.y += dt * 0.14;
    }
    // 展台风环
    this.ring1.rotation.z += dt * 0.2;
    this.ring2.rotation.z -= dt * 0.32;
    this.beam.material.opacity = 0.04 + Math.sin(t * 1.6) * 0.012;
    this.stars.rotation.y += dt * 0.004;

    // 相机
    const o = this.orbit;
    if (this.autoRotate) o.tTheta += dt * 0.1;
    o.theta += (o.tTheta - o.theta) * Math.min(1, dt * 6);
    o.phi += (o.tPhi - o.phi) * Math.min(1, dt * 6);
    o.dist += (o.tDist - o.dist) * Math.min(1, dt * 5);
    const sp = Math.sin(o.phi);
    this.camera.position.set(
      o.dist * sp * Math.sin(o.theta),
      o.dist * Math.cos(o.phi) + 1.5,
      o.dist * sp * Math.cos(o.theta)
    );
    this.camera.lookAt(0, 1.6, 0);

    this.composer.render();
  };

  _disposeObject(root) {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
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
    window.removeEventListener('resize', this._onResize);
    if (this.ship) this._disposeObject(this.ship);
    if (this.composer) this.composer.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      if (el && el.parentElement) el.parentElement.removeChild(el);
    }
  }
}

export { SHIP_VARIANTS };
