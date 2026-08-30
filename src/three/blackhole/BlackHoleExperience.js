// GARGANTUA — 黑洞体验引擎（完整版：参考实现移植，全中文界面）
// EffectComposer 泛光管线 / 21 项参数 / 三档画质 / 四视角飞行 / 电影运镜 / 遥测 HUD
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RAY_VERT, RAY_FRAG, COMPOSITE_VERT, COMPOSITE_FRAG } from './geodesicShader.js';

const DEG = Math.PI / 180;
const STORE_KEY = 'gargantua.embedded.v1';

const TIERS = {
  standard:  { name: '标准',   short: '标准', steps: 200, dpr: 1 },
  high:      { name: '高',     short: '高',   steps: 320, dpr: 1.5 },
  cinematic: { name: '电影级', short: '电影', steps: 460, dpr: 2 }
};
const TIER_ORDER = ['standard', 'high', 'cinematic'];

const PRESETS = {
  poster: { name: '海报 38°', r: 24, inc: 38, az: 30 },
  edge:   { name: '盘面',     r: 26, inc: 6,  az: 10 },
  polar:  { name: '极向',     r: 28, inc: 82, az: 0 },
  close:  { name: '近距掠过', r: 9,  inc: 14, az: 55 }
};
const PRESET_KEYS = ['poster', 'edge', 'polar', 'close'];

// 电影运镜：8 个球面关键帧（r, 倾角°, 方位角°），Catmull-Rom 闭合样条
const CINE_R   = [58, 36, 26, 14, 20, 34, 46, 36];
const CINE_INC = [12, 6, 24, 14, 52, 80, 35, 8];
const CINE_AZ  = [-30, 10, 55, 100, 150, 200, 270, 330];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function sphToVec(r, inc, az, out) {
  const i = inc * DEG, a = az * DEG;
  out.set(r * Math.cos(i) * Math.sin(a), r * Math.sin(i), r * Math.cos(i) * Math.cos(a));
  return out;
}
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
const arrAt = (arr, j) => arr[((j % arr.length) + arr.length) % arr.length];
function unwrapNear(a, ref) {
  while (a - ref > 180) a -= 360;
  while (a - ref < -180) a += 360;
  return a;
}

export class BlackHoleExperience {
  constructor(container) {
    this.container = container;
    this.rafId = 0;
    this.clock = new THREE.Clock();
    this.tShader = 0;
    this.cineTime = 0;
    this.cineBlend = null;
    this.cineMode = false;
    this.tierName = 'high';
    this.fpsSmooth = 0;
    this._fpsFrames = 0;
    this._fpsTime = 0;
    this._lowFpsSec = 0;
    this._lowFpsToasted = false;
    this.readyFired = false;
    this.contextLost = false;
    this.contextRestored = false;
    this.renderFaulted = false;
    this.flight = { active: false, t: 0, dur: 2.6, from: new THREE.Vector3(), to: new THREE.Vector3() };
    this.bootTime = performance.now();
    this.P = {};
    this._timers = [];
    this._listeners = [];
    this.bufSize = new THREE.Vector2();
    this.tmpVec = new THREE.Vector3();
  }

  /* ================================ DOM ================================ */
  buildDOM() {
    const c = this.container;
    c.innerHTML = `
      <div class="bh2-hud">
        <div class="bh2-title">
          <h1>GARGANTUA</h1>
          <div class="bh2-sub">超大质量黑洞 · 1.0 × 10⁸ M☉</div>
          <div class="bh2-sub2">史瓦西度规 // 零测地线光线追踪</div>
        </div>
        <div class="bh2-clock">
          <div class="bh2-label">探索时长</div>
          <div class="bh2-clockval">00:00:00</div>
        </div>
        <div class="bh2-telemetry">
          <div class="bh2-row"><span class="k">观测距离</span><span class="v" data-t="dist">—</span></div>
          <div class="bh2-row"><span class="k">盘面倾角</span><span class="v" data-t="inc">—</span></div>
          <div class="bh2-row"><span class="k">测地线步数</span><span class="v" data-t="steps">—</span></div>
          <div class="bh2-row"><span class="k">渲染档位</span><span class="v" data-t="prof">—</span></div>
          <div class="bh2-row"><span class="k">帧率</span><span class="v" data-t="fps">—</span></div>
        </div>
      </div>

      <div class="bh2-deck">
        <div class="bh2-deck-title"><span data-deckmode>电影镜头序列</span><span class="bh2-dot"></span></div>
        <button class="bh2-btn wide" data-act="cine">▶ 电影镜头序列</button>
        <div class="bh2-grid2">
          ${PRESET_KEYS.map(k => `<button class="bh2-btn" data-preset="${k}">${PRESETS[k].name}</button>`).join('')}
        </div>
        <div class="bh2-grid4">
          <button class="bh2-btn" data-act="orbit">自动环绕</button>
          <button class="bh2-btn" data-act="quality">高</button>
          <button class="bh2-btn" data-act="params">参数</button>
          <button class="bh2-btn" data-act="hud">界面</button>
        </div>
        <button class="bh2-btn wide" data-act="sound">🔇 声音：关</button>
        <div class="bh2-deck-hint" data-deckhint>拖拽即可接管镜头</div>
      </div>

      <div class="bh2-params hidden">
        <div class="bh2-p-head"><span>参数</span><button class="bh2-btn" data-act="reset">重置</button></div>
        <div class="bh2-p-rows" data-prows></div>
      </div>

      <div class="bh2-hintbar" data-hintbar>拖拽环绕 · 滚轮缩放 · 1-4 视角 · C 电影 · R 环绕 · P 参数 · M 声音 · H 界面</div>
      <div class="bh2-toast" data-toast></div>

      <div class="bh2-intro" data-intro>
        <div class="bh2-intro-card">
          <div class="bh2-intro-tag">实时相对论光线追踪</div>
          <div class="bh2-intro-title">GARGANTUA</div>
          <div class="bh2-intro-quote">“不要温和地走进那个良夜。”</div>
        </div>
      </div>

      <div class="bh2-fatal" data-fatal>
        <div class="bh2-fatal-card">
          <div class="bh2-fatal-title" data-fataltitle>信号丢失</div>
          <div class="bh2-fatal-msg" data-fatalmsg></div>
          <div class="bh2-fatal-btns">
            <button class="bh2-btn" data-act="lower">▼ 降低画质</button>
            <button class="bh2-btn" data-act="retry">↻ 重新初始化</button>
          </div>
        </div>
      </div>
    `;
    this.$ = (sel) => c.querySelector(sel);
    this.$$ = (sel) => Array.from(c.querySelectorAll(sel));
  }

  /* =============================== three =============================== */
  initThree() {
    const canvas = document.createElement('canvas');
    canvas.className = 'bh2-canvas';
    this.container.insertBefore(canvas, this.container.firstChild);
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.debug.onShaderError = (gl, program, vs, fs) => {
      const log = (gl.getShaderInfoLog(fs) || '') + '\n' + (gl.getShaderInfoLog(vs) || '');
      this.showFatal('着色器编译失败', (log.trim() || '未知着色器错误').slice(0, 900));
    };

    this._onCtxLost = (e) => {
      e.preventDefault();
      this.contextLost = true;
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
      this.showFatal('WEBGL 上下文丢失', 'GPU 上下文已丢失，渲染停止。请重新初始化，或先降低画质减轻负载。');
    };
    this._onCtxRestored = () => {
      if (this.contextRestored) return;
      this.contextRestored = true;
      location.reload();
    };
    canvas.addEventListener('webglcontextlost', this._onCtxLost);
    canvas.addEventListener('webglcontextrestored', this._onCtxRestored);

    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsScene = new THREE.Scene();
    this.rayUni = {
      uRes:        { value: new THREE.Vector2(1, 1) },
      uTime:       { value: 0 },
      uCamPos:     { value: new THREE.Vector3(4.49, 2.72, 25.46) },
      uCamTarget:  { value: new THREE.Vector3(0, 0, 0) },
      uFov:        { value: 1 / Math.tan(44 * DEG / 2) },
      uSteps:      { value: 320 },
      uRotSign:    { value: 1 },
      uDebug:      { value: 0 },
      uDin:        { value: 2.75 },
      uDout:       { value: 40 },
      uDopMax:     { value: 1.85 },
      uOpNear:     { value: 0.90 },
      uOpFar:      { value: 0.80 },
      uDiskBright: { value: 1 },
      uStarBright: { value: 1 },
      uSkyFloor:   { value: 0.04 },
      uRotSpeed:   { value: 1 }
    };
    this.fsScene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: RAY_VERT,
        fragmentShader: RAY_FRAG,
        uniforms: this.rayUni,
        depthTest: false,
        depthWrite: false
      })
    ));

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.01, 200);
    this.camera.position.set(4.49, 2.72, 25.46);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.62;
    this.controls.maxDistance = 150;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.7;
    this.controls.enablePan = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.12;

    this.renderer.getDrawingBufferSize(this.bufSize);
    const gl = this.renderer.getContext();
    const halfOK = this.renderer.capabilities.isWebGL2 &&
      !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    const rt = new THREE.WebGLRenderTarget(this.bufSize.x || 2, this.bufSize.y || 2, {
      type: halfOK ? THREE.HalfFloatType : THREE.UnsignedByteType
    });
    this._halfOK = halfOK;
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.fsScene, this.fsCam));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.bufSize.x || 2, this.bufSize.y || 2), 0.55, 0.35, 0.55);
    this.composer.addPass(this.bloomPass);
    const compPass = new ShaderPass({
      uniforms: {
        tDiffuse:  { value: null },
        uRes:      { value: new THREE.Vector2(1, 1) },
        uTime:     { value: 0 },
        uVignette: { value: 1 },
        uGrain:    { value: 0.045 },
        uCA:       { value: 0.0028 }
      },
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG
    });
    this.composer.addPass(compPass);
    this.compUni = compPass.uniforms; // ShaderPass 会克隆 uniform，必须取克隆后的引用
  }

  /* ============================= 21 项参数 ============================= */
  buildParamDefs() {
    return [
      { key: 'steps', label: '测地线步数', min: 60, max: 600, step: 10, def: null,
        fmt: v => v.toFixed(0), apply: v => { this.rayUni.uSteps.value = v; } },
      { key: 'din', label: '吸积盘内缘', min: 2.0, max: 4.0, step: 0.05, def: 2.75,
        fmt: v => v.toFixed(2), apply: v => { this.rayUni.uDin.value = v; } },
      { key: 'dout', label: '吸积盘外缘', min: 10, max: 80, step: 1, def: 40,
        fmt: v => v.toFixed(0), apply: v => { this.rayUni.uDout.value = v; } },
      { key: 'dopMax', label: '多普勒增亮上限', min: 1, max: 3, step: 0.05, def: 1.85,
        fmt: v => v.toFixed(2), apply: v => { this.rayUni.uDopMax.value = v; } },
      { key: 'opNear', label: '盘不透明度·内', min: 0.50, max: 1, step: 0.01, def: 0.90,
        fmt: v => v.toFixed(2), apply: v => { this.rayUni.uOpNear.value = v; } },
      { key: 'opFar', label: '盘不透明度·外', min: 0.30, max: 1, step: 0.01, def: 0.80,
        fmt: v => v.toFixed(2), apply: v => { this.rayUni.uOpFar.value = v; } },
      { key: 'diskBright', label: '盘面亮度', min: 0.2, max: 3, step: 0.05, def: 1,
        fmt: v => v.toFixed(2), apply: v => { this.rayUni.uDiskBright.value = v; } },
      { key: 'starBright', label: '星场亮度', min: 0.2, max: 3, step: 0.05, def: 1,
        fmt: v => v.toFixed(2), apply: v => { this.rayUni.uStarBright.value = v; } },
      { key: 'skyFloor', label: '天空底光', min: 0, max: 0.15, step: 0.005, def: 0.04,
        fmt: v => v.toFixed(3), apply: v => { this.rayUni.uSkyFloor.value = v; } },
      { key: 'rotSpeed', label: '盘面转速', min: 0, max: 3, step: 0.05, def: 1,
        fmt: v => v.toFixed(2), apply: v => { this.rayUni.uRotSpeed.value = v; } },
      { key: 'bloomStrength', label: '泛光强度', min: 0, max: 1.5, step: 0.05, def: 0.55,
        fmt: v => v.toFixed(2), apply: v => { this.bloomPass.strength = v; } },
      { key: 'bloomRadius', label: '泛光半径', min: 0, max: 1, step: 0.05, def: 0.35,
        fmt: v => v.toFixed(2), apply: v => { this.bloomPass.radius = v; } },
      { key: 'bloomThreshold', label: '泛光阈值', min: 0, max: 1, step: 0.05, def: 0.55,
        fmt: v => v.toFixed(2), apply: v => { this.bloomPass.threshold = v; } },
      { key: 'vignette', label: '暗角', min: 0, max: 1.5, step: 0.05, def: 1,
        fmt: v => v.toFixed(2), apply: v => { this.compUni.uVignette.value = v; } },
      { key: 'grain', label: '胶片颗粒', min: 0, max: 0.15, step: 0.005, def: 0.045,
        fmt: v => v.toFixed(3), apply: v => { this.compUni.uGrain.value = v; } },
      { key: 'ca', label: '色差', min: 0, max: 0.01, step: 0.0005, def: 0.0028,
        fmt: v => v.toFixed(4), apply: v => { this.compUni.uCA.value = v; } },
      { key: 'fov', label: '镜头视场角', min: 25, max: 80, step: 1, def: 44,
        fmt: v => v.toFixed(0) + '°',
        apply: v => {
          this.camera.fov = v;
          this.camera.updateProjectionMatrix();
          this.rayUni.uFov.value = 1 / Math.tan(v * DEG / 2);
        } },
      { key: 'maxDist', label: '最大距离', min: 40, max: 300, step: 5, def: 150,
        fmt: v => v.toFixed(0) + ' rs', apply: v => { this.controls.maxDistance = v; } },
      { key: 'orbitSpeed', label: '自动环绕速度', min: 0, max: 1, step: 0.02, def: 0.12,
        fmt: v => v.toFixed(2), apply: v => { this.controls.autoRotateSpeed = v; } },
      { key: 'cineSeg', label: '电影段时长', min: 4, max: 30, step: 1, def: 11,
        fmt: v => v.toFixed(0) + 's', apply: () => {} },
      { key: 'debug', label: '调试视图', min: 0, max: 9, step: 1, def: 0,
        fmt: v => v.toFixed(0),
        apply: v => {
          this.rayUni.uDebug.value = v;
          this.bloomPass.enabled = Math.round(v) <= 2;
        } }
    ];
  }

  paramDefault(def) { return def.key === 'steps' ? TIERS[this.tierName].steps : def.def; }

  loadStorage() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { data = null; }
    if (data && TIERS[data.tier]) this.tierName = data.tier;
    for (const def of this.paramDefs) {
      let v = this.paramDefault(def);
      if (data && Number.isFinite(data[def.key])) v = clamp(data[def.key], def.min, def.max);
      this.P[def.key] = v;
    }
  }

  saveStorage() {
    try {
      const data = { tier: this.tierName };
      for (const def of this.paramDefs) data[def.key] = this.P[def.key];
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* 隐私模式静默 */ }
  }

  applyParam(def, updateRow = true) {
    def.apply(this.P[def.key]);
    const row = this.rowEls[def.key];
    if (updateRow && row) {
      row.input.value = this.P[def.key];
      row.valEl.textContent = def.fmt(this.P[def.key]);
    }
  }

  buildParamsPanel() {
    const rows = this.$('[data-prows]');
    this.rowEls = {};
    for (const def of this.paramDefs) {
      const row = document.createElement('div');
      row.className = 'bh2-p-row';
      const meta = document.createElement('div');
      meta.className = 'bh2-p-meta';
      const label = document.createElement('label');
      label.textContent = def.label;
      const val = document.createElement('span');
      val.className = 'bh2-p-val';
      meta.append(label, val);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = def.min; input.max = def.max; input.step = def.step;
      input.addEventListener('input', () => {
        this.P[def.key] = clamp(parseFloat(input.value), def.min, def.max);
        this.applyParam(def, false);
        val.textContent = def.fmt(this.P[def.key]);
        this.updateTelemetry();
        this.saveStorage();
      });
      row.append(meta, input);
      rows.appendChild(row);
      this.rowEls[def.key] = { input, valEl: val };
    }
  }

  /* =============================== 画质档 =============================== */
  setTier(name, announce = true) {
    this.tierName = name;
    const tier = TIERS[name];
    this.P.steps = tier.steps;
    this.applyParam(this.paramDefs[0]);
    const qBtn = this.$('[data-act="quality"]');
    if (qBtn) qBtn.textContent = tier.short;
    this.resize();
    this.updateTelemetry();
    this.saveStorage();
    if (announce) this.toast(`渲染档位 — ${tier.name} · ${tier.steps} 步`);
  }

  /* ================================ HUD ================================ */
  updateTelemetry() {
    if (!this.camera) return;
    const d = this.camera.position.length();
    this.setT('dist', d.toFixed(2) + ' rs');
    this.setT('inc', (Math.asin(clamp(this.camera.position.y / d, -1, 1)) / DEG).toFixed(1) + '°');
    this.setT('steps', String(Math.round(this.P.steps)));
    this.setT('prof', TIERS[this.tierName].name);
    this.setT('fps', this.fpsSmooth > 0 ? Math.round(this.fpsSmooth) + ' FPS' : '—');
  }

  setT(key, val) {
    const el = this.container.querySelector(`[data-t="${key}"]`);
    if (el) el.textContent = val;
  }

  trackFps(dt) {
    this._fpsFrames++; this._fpsTime += dt;
    if (this._fpsTime >= 1) {
      const fps = this._fpsFrames / this._fpsTime;
      this.fpsSmooth = this.fpsSmooth > 0 ? this.fpsSmooth * 0.6 + fps * 0.4 : fps;
      if (this.fpsSmooth < 24) {
        this._lowFpsSec++;
        if (this._lowFpsSec >= 5 && !this._lowFpsToasted) {
          this._lowFpsToasted = true;
          this.toast('帧率偏低 — 建议降低画质');
        }
      } else this._lowFpsSec = 0;
      this._fpsFrames = 0; this._fpsTime = 0;
    }
  }

  /* ============================ 电影运镜 ============================ */
  cinePosAt(time, out) {
    const seg = Math.max(1, this.P.cineSeg);
    const s = ((time / seg) % 8 + 8) % 8;
    const i = Math.floor(s), t = s - i;
    const r = cr(arrAt(CINE_R, i - 1), arrAt(CINE_R, i), arrAt(CINE_R, i + 1), arrAt(CINE_R, i + 2), t);
    const inc = cr(arrAt(CINE_INC, i - 1), arrAt(CINE_INC, i), arrAt(CINE_INC, i + 1), arrAt(CINE_INC, i + 2), t);
    const a1 = arrAt(CINE_AZ, i);
    const a0 = unwrapNear(arrAt(CINE_AZ, i - 1), a1);
    const a2 = unwrapNear(arrAt(CINE_AZ, i + 1), a1);
    const a3 = unwrapNear(arrAt(CINE_AZ, i + 2), a2);
    const az = cr(a0, a1, a2, a3, t);
    return sphToVec(r, inc, az, out);
  }

  updateCine(dt) {
    const pos = this.cinePosAt(this.cineTime, this.tmpVec);
    if (this.cineBlend) {
      this.cineBlend.t += dt;
      const k = easeCubic(Math.min(this.cineBlend.t / 2, 1));
      pos.lerpVectors(this.cineBlend.from, pos, k);
      if (this.cineBlend.t >= 2) this.cineBlend = null;
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(0, 0, 0);
  }

  flyToPreset(name) {
    const pr = PRESETS[name];
    if (!pr) return;
    if (this.cineMode) this.breakCine();
    this.flight.active = true;
    this.flight.t = 0;
    this.flight.from.copy(this.camera.position);
    sphToVec(pr.r, pr.inc, pr.az, this.flight.to);
    this.controls.enabled = false;
  }

  updateFlight(dt) {
    this.flight.t += dt;
    const k = easeCubic(Math.min(this.flight.t / this.flight.dur, 1));
    this.camera.position.lerpVectors(this.flight.from, this.flight.to, k);
    this.camera.lookAt(0, 0, 0);
    if (this.flight.t >= this.flight.dur) {
      this.flight.active = false;
      this.controls.enabled = true;
    }
  }

  syncDeck() {
    const mode = this.$('[data-deckmode]');
    if (mode) mode.textContent = this.cineMode ? '电影镜头序列' : '自由导航';
    const cineBtn = this.$('[data-act="cine"]');
    if (cineBtn) {
      cineBtn.classList.toggle('active', this.cineMode);
      cineBtn.textContent = this.cineMode ? '⏸ 电影镜头序列' : '▶ 电影镜头序列';
    }
    const orbitBtn = this.$('[data-act="orbit"]');
    if (orbitBtn) orbitBtn.classList.toggle('active', this.controls.autoRotate && !this.cineMode);
  }

  breakCine() {
    if (!this.cineMode) return;
    this.cineMode = false;
    this.cineBlend = null;
    this.controls.enabled = true;
    this.syncDeck();
    const hint = this.$('[data-deckhint]');
    if (hint && !this._deckHintShown) {
      this._deckHintShown = true;
      hint.classList.add('show');
      setTimeout(() => hint.classList.remove('show'), 6000);
    }
  }

  toggleCine() {
    if (this.cineMode) { this.breakCine(); return; }
    this.flight.active = false;
    this.cineMode = true;
    this.controls.enabled = false;
    this.controls.autoRotate = false;
    this.cineBlend = { t: 0, from: this.camera.position.clone() };
    this.syncDeck();
  }

  toggleOrbit() {
    if (this.cineMode) {
      this.breakCine();
      this.controls.autoRotate = true;
    } else {
      this.controls.autoRotate = !this.controls.autoRotate;
    }
    this.syncDeck();
  }

  toggleParams() {
    const el = this.$('.bh2-params');
    const hidden = el.classList.toggle('hidden');
    const btn = this.$('[data-act="params"]');
    if (btn) btn.classList.toggle('active', !hidden);
  }

  toggleHud() {
    const off = this.$('.bh2-hud').classList.toggle('off');
    const btn = this.$('[data-act="hud"]');
    if (btn) btn.classList.toggle('active', !off);
  }

  /* ================================ 声音 ================================ */
  toggleSound() {
    if (!this.soundOn) {
      try {
        if (!this.audioCtx) this.buildAudio();
        const ctx = this.audioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        this.masterGain.gain.setTargetAtTime(0.5, ctx.currentTime, 1.0);
        this.soundOn = true;
      } catch (e) { this.soundOn = false; }
    } else {
      if (this.audioCtx) this.masterGain.gain.setTargetAtTime(0.0, this.audioCtx.currentTime, 0.4);
      this.soundOn = false;
    }
    const btn = this.$('[data-act="sound"]');
    if (btn) {
      btn.textContent = this.soundOn ? '🔊 声音：开' : '🔇 声音：关';
      btn.classList.toggle('active', this.soundOn);
    }
  }

  buildAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    this.audioCtx = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(ctx.destination);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 0.6;
    lp.connect(this.masterGain);
    [[55, 'sine', 0.5], [55.6, 'sine', 0.5], [110.3, 'triangle', 0.14], [164.6, 'triangle', 0.1]].forEach(([f, type, g]) => {
      const osc = ctx.createOscillator();
      osc.type = type; osc.frequency.value = f;
      const gn = ctx.createGain(); gn.gain.value = g;
      osc.connect(gn); gn.connect(lp); osc.start();
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoG = ctx.createGain(); lfoG.gain.value = 130;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    // 星风噪声
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.value = 0.014;
    noise.connect(bp); bp.connect(ng); ng.connect(this.masterGain); noise.start();
  }

  /* ============================== 提示/故障 ============================== */
  toast(msg, ms = 4200) {
    const t = this.$('[data-toast]');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  showFatal(title, msg) {
    this.$('[data-fataltitle]').textContent = title;
    this.$('[data-fatalmsg]').textContent = msg;
    this.$('[data-fatal]').classList.add('show');
  }

  /* ================================ 尺寸 ================================ */
  resize() {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[this.tierName].dpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.getDrawingBufferSize(this.bufSize);
    this.rayUni.uRes.value.copy(this.bufSize);
    this.compUni.uRes.value.copy(this.bufSize);
  }

  /* =============================== 主循环 =============================== */
  animate = () => {
    this.rafId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.tShader += dt;

    if (this.flight.active) this.updateFlight(dt);
    else if (this.cineMode) { this.cineTime += dt; this.updateCine(dt); }
    this.controls.update();

    this.rayUni.uTime.value = this.tShader;
    this.rayUni.uCamPos.value.copy(this.camera.position);
    this.rayUni.uCamTarget.value.copy(this.controls.target);
    this.compUni.uTime.value = this.tShader;

    try {
      this.composer.render();
    } catch (err) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
      if (!this.renderFaulted) {
        this.renderFaulted = true;
        this.showFatal('渲染故障', '渲染器报告不可恢复错误：' +
          String((err && err.message) || err).slice(0, 400) + ' — 请重新初始化或降低画质。');
      }
      return;
    }

    this.trackFps(dt);

    if (!this.readyFired) {
      this.readyFired = true;
      const intro = this.$('[data-intro]');
      if (intro) {
        intro.classList.add('done');
        setTimeout(() => intro.remove(), 1400);
      }
      const hb = this.$('[data-hintbar]');
      if (hb) {
        setTimeout(() => {
          hb.classList.add('show');
          setTimeout(() => hb.classList.remove('show'), 10000);
        }, 2500);
      }
    }
  };

  /* =============================== 事件绑定 =============================== */
  bindEvents() {
    this.$$('.bh2-btn').forEach((btn) => {
      const act = btn.dataset.act;
      const preset = btn.dataset.preset;
      if (preset) {
        btn.addEventListener('click', () => this.flyToPreset(preset));
      } else if (act === 'cine') btn.addEventListener('click', () => this.toggleCine());
      else if (act === 'orbit') btn.addEventListener('click', () => this.toggleOrbit());
      else if (act === 'quality') btn.addEventListener('click', () => {
        const idx = TIER_ORDER.indexOf(this.tierName);
        this.setTier(TIER_ORDER[(idx + 1) % TIER_ORDER.length]);
      });
      else if (act === 'params') btn.addEventListener('click', () => this.toggleParams());
      else if (act === 'hud') btn.addEventListener('click', () => this.toggleHud());
      else if (act === 'sound') btn.addEventListener('click', () => this.toggleSound());
      else if (act === 'reset') btn.addEventListener('click', () => {
        try { localStorage.removeItem(STORE_KEY); } catch (e) { /* 忽略 */ }
        for (const def of this.paramDefs) this.P[def.key] = this.paramDefault(def);
        this.paramDefs.forEach(d => this.applyParam(d));
        this.updateTelemetry();
        this.toast('参数已重置');
      });
      else if (act === 'retry') btn.addEventListener('click', () => location.reload());
      else if (act === 'lower') btn.addEventListener('click', () => {
        const idx = TIER_ORDER.indexOf(this.tierName);
        this.tierName = TIER_ORDER[Math.max(0, idx - 1)];
        this.saveStorage();
        location.reload();
      });
    });

    this._onManual = () => {
      if (this.flight.active) { this.flight.active = false; this.controls.enabled = true; }
      this.breakCine();
    };
    this.canvas.addEventListener('pointerdown', this._onManual, { capture: true });
    this.canvas.addEventListener('wheel', this._onManual, { capture: true, passive: true });
    this.controls.addEventListener('start', this._onManual);

    this._onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k >= '1' && k <= '4') this.flyToPreset(PRESET_KEYS[+k - 1]);
      else if (k === 'c') this.toggleCine();
      else if (k === 'r') this.toggleOrbit();
      else if (k === 'p') this.toggleParams();
      else if (k === 'm') this.toggleSound();
      else if (k === 'h') this.toggleHud();
    };
    window.addEventListener('keydown', this._onKey);

    this._onVis = () => {
      if (document.hidden) {
        if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
      } else if (!this.rafId && !this.contextLost && !this.renderFaulted) {
        this.clock.getDelta();
        this.rafId = requestAnimationFrame(this.animate);
      }
    };
    document.addEventListener('visibilitychange', this._onVis);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);

    this._timers.push(setInterval(() => this.updateTelemetry(), 250));
    this._timers.push(setInterval(() => {
      const s = Math.floor((performance.now() - this.bootTime) / 1000) % 86400;
      const el = this.$('.bh2-clockval');
      if (el) {
        el.textContent = [3600, 60, 1].map(u => String(Math.floor(s / u) % (u === 3600 ? 100 : 60)).padStart(2, '0')).join(':');
      }
    }, 1000));
  }

  /* ================================ 启动 ================================ */
  init() {
    this.buildDOM();
    this.initThree();
    this.paramDefs = this.buildParamDefs();
    this.buildParamsPanel();
    this.loadStorage();
    this.paramDefs.forEach(d => this.applyParam(d));
    this.$('[data-act="quality"]').textContent = TIERS[this.tierName].short;

    // 默认进入电影运镜
    this.cineMode = true;
    this.controls.enabled = false;
    this.controls.autoRotate = false;
    this.updateCine(0);
    this.syncDeck();

    this.resize();
    this.bindEvents();
    this.updateTelemetry();
    if (!this._halfOK) this.toast('HDR 缓冲不可用 — 已回退 LDR 渲染', 6000);
    this.rafId = requestAnimationFrame(this.animate);

    // 安全网：绝不让用户停留在黑屏
    setTimeout(() => {
      if (!this.readyFired) {
        this.readyFired = true;
        const intro = this.$('[data-intro]');
        if (intro) { intro.classList.add('done'); setTimeout(() => intro.remove(), 1400); }
      }
    }, 9000);
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this._timers.forEach(clearInterval);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    document.removeEventListener('visibilitychange', this._onVis);
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this._onCtxLost);
      this.canvas.removeEventListener('webglcontextrestored', this._onCtxRestored);
    }
    if (this.audioCtx) { try { this.audioCtx.close(); } catch (e) { /* 忽略 */ } }
    try {
      this.controls.dispose();
      this.composer.dispose && this.composer.dispose();
      this.renderer.dispose();
    } catch (e) { /* 忽略 */ }
    this.container.innerHTML = '';
  }
}
