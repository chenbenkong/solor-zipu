import * as THREE from 'three';
import { createStarship } from './createStarship.js';

/**
 * 星隼号 ZF-77 —— 飞行 / 导航 / 视角系统
 *
 * 飞行模式 mode：
 *  - 'orbit'   景观悬停：飞船静止悬浮，相机缓慢环绕（展示模型）
 *  - 'cruise'  自由驾驶：W/S 油门、A/D 偏航、方向键俯仰、Q/E 滚转
 *  - 'nav'     自动驾驶：脉冲跳跃 → 行星接近 → 锁定最佳观赏点
 *
 * 视角 cameraMode：'chase' 第三视角 / 'cockpit' 第一视角（巨型透明舷窗 + 可收起控制台）
 * 观赏锁定 navLock：到达后随行星自转/公转持续追踪，保存并复用最佳观赏位置
 */

const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();
const tmpQ1 = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpM1 = new THREE.Matrix4();

const VIEW_LOCK_KEY = 'starship-viewlock-v2';
const AIM_UP = new THREE.Vector3();
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const SUN_TMP = new THREE.Vector3();
export class ShipSystem {
  constructor(scene, camera, renderer, solarSystemGroup, planetMeshes, sun, opts = {}) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.solarSystem = solarSystemGroup;
    this.planetMeshes = planetMeshes || [];
    this.sun = sun;
    this.envMap = opts.envMap || null;
    this.namedAsteroids = opts.namedAsteroids || [];

    this.enabled = false;
    this.mode = 'orbit';           // orbit | cruise | nav
    this.cameraMode = 'chase';     // chase | cockpit
    this.navTarget = null;         // { name, mesh, radius, kind, selfRotating }
    this.navPhase = 'idle';        // idle | jump | approach | locked
    this.navLock = false;
    this.savedView = null;         // 最佳观赏位置（相对行星的局部坐标 + 朝向）
    this.navMessage = null;        // 一次性提示（目标未找到等）

    // 飞行参数
    this.throttle = 0;
    this.displaySpeed = 0;
    this.maxCruiseSpeed = 340;
    this.accel = 130;
    this.turnRate = 0.85;
    this.pitchRate = 0.65;
    this.rollRate = 1.1;
    this.jumpSpeed = 2400;
    this.viewFactor = 3.4;        // 最佳观赏距离 = 行星半径 × 系数
    this.orbitAngle = 0;

    // 内部状态
    this._jumpFrom = new THREE.Vector3();
    this._jumpStart = 0;
    this._prevPos = new THREE.Vector3();
    this._navPrevWp = null;
    this._navApproachStart = 0;
    this._navPrevDesired = null;
    this._lockPrevAnchor = null;
    this._savedCamPos = null;
    this._savedCamTarget = null;
    this._saveAccum = 0;
    this._time = 0;
    this.consoleVisible = true;
    this._consoleTarget = true;
    this._camBlend = 1;
    this._chasePrevAnchor = null;
    this._stickX = 0;            // 摇杆横向 -1~1：左右转向
    this._stickY = 0;            // 摇杆纵向 -1~1：俯仰
    this._stickRoll = 0;         // 摇杆侧向滚转（左右平移键）
    this._stickThrottle = 0;     // 虚拟油门 0~1
    this._chaseOrbit = 0;        // 第三视角环绕角（弧度，可 360° 旋转）
    this._chaseElev = 0.24;      // 第三视角仰角系数
    this._chaseDist = 26;        // 第三视角距离（拉近感调校）

    const built = createStarship(this.envMap);
    if (typeof window !== 'undefined') window.__shipDbg = this;
    this.ship = built.group;
    this.shipParts = built;
    this.ship.visible = false;
    this.shipState = {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion()
    };
    this.ship.position.copy(this.shipState.position);
    this.ship.quaternion.copy(this.shipState.quaternion);
    this.shipRenderQ = new THREE.Quaternion();
    scene.add(this.ship);
  }

  /* ================= 生命周期 ================= */

  enable(spawnPos) {
    this.enabled = true;
    this.mode = 'orbit';
    this.cameraMode = 'chase';
    this.navTarget = null;
    this.navPhase = 'idle';
    this.navLock = false;
    this.savedView = null;
    this.throttle = 0;
    this.displaySpeed = 0;
    this.orbitAngle = Math.PI * 0.25;
    this.shipState.position.copy(spawnPos || new THREE.Vector3(0, 120, 900));
    // 机头朝向原点（太阳系中心）
    this._aimNoseAt(tmpV1.set(0, 0, 0));
    this.shipState.quaternion.copy(this._aimQ);
    this.ship.visible = true;
    if (this.shipParts.console) this.shipParts.console.visible = this.consoleVisible;
    this._camBlend = 0;
    this._chasePrevAnchor = null;
    this._prevPos.copy(this.shipState.position);
    // 相机接管前的原相机位姿（退出时恢复）
    this._savedCamPos = this.camera.position.clone();
    this._savedCamTarget = null;
    this.orbitRadius = 14;
  }

  disable() {
    this.enabled = false;
    this.ship.visible = false;
    this.navLock = false;
    this.navPhase = 'idle';
    this.throttle = 0;
    this.shipParts.setThrottle(0);
  }

  /* ================= 输入接口 ================= */

  setFlightMode(m) {
    if (m !== 'orbit' && m !== 'cruise') return;
    this.mode = m;
    if (m === 'orbit') this.throttle = 0;
    // 手动接管：解除自动驾驶与观赏锁定
    if (this.navLock || this.navPhase !== 'idle' || this.navTarget) {
      this.navLock = false;
      this.navPhase = 'idle';
      this.navTarget = null;
      this._navPrevWp = null;
      this._navPrevDesired = null;
      this._lockPrevAnchor = null;
      this.navMessage = { text: '已切换手动模式，自动驾驶解除', tone: 'info', at: Date.now() };
    }
  }

  setCameraMode(m) {
    if (m !== 'chase' && m !== 'cockpit') return;
    this.cameraMode = m;
    this._camBlend = 0;
    this._chasePrevAnchor = null;
  }

  toggleCameraMode() {
    this.cameraMode = this.cameraMode === 'chase' ? 'cockpit' : 'chase';
    this._camBlend = 0;
    this._chasePrevAnchor = null;
  }

  setConsoleVisible(v) {
    this.consoleVisible = !!v;
    this._consoleTarget = !!v;
    if (this.shipParts && this.shipParts.console) this.shipParts.console.visible = !!v;
  }

  toggleConsole() {
    this.setConsoleVisible(!this.consoleVisible);
  }

  // 按名称选择导航目标：恒星 / 行星 / 卫星 / 知名小行星
  setNavTargetByName(name) {
    const t = this._findCelestial(name);
    if (!t) {
      this.navMessage = { text: `导航目标「${name}」未找到`, tone: 'warn', at: Date.now() };
      return false;
    }
    this.navTarget = t;
    this.mode = 'nav';
    this.navLock = false;
    this.navPhase = 'jump';
    this._jumpFrom.copy(this.shipState.position);
    this._jumpStart = this._time;
    this._navPrevDesired = null;
    this._lockPrevAnchor = null;

    // 已有保存的最佳观赏位置 → 直接复用（不重新计算）
    const saved = this._loadSavedView();
    if (saved && saved.target === t.name) {
      this.savedView = saved;
    } else {
      this.savedView = null;
    }
    this.navMessage = { text: `自动导航已锁定：${t.name}`, tone: 'ok', at: Date.now() };
    return true;
  }

  cancelNav() {
    this.navTarget = null;
    this._navPrevWp = null;
    this._navPrevDesired = null;
    this._lockPrevAnchor = null;
    this.navPhase = 'idle';
    this.navLock = false;
    this.mode = 'cruise';
    this.navMessage = { text: '自动驾驶已解除，切换自由驾驶', tone: 'info', at: Date.now() };
  }

  /* ================= 目标查找 ================= */

  _findCelestial(name) {
    if (!name) return null;
    if (name === '太阳' && this.sun) {
      return { name, mesh: this.sun, radius: 300, kind: 'star', selfRotating: false };
    }
    for (const p of this.planetMeshes) {
      if (p.name === name) {
        return { name, mesh: p.mesh, radius: p.radius, kind: 'planet', selfRotating: true };
      }
      if (p.moons && p.moons.length) {
        for (const me of p.moons) {
          if (me.config && me.config.name === name) {
            return {
              name,
              mesh: me.mesh,
              radius: me.mesh.geometry && me.mesh.geometry.parameters ? me.mesh.geometry.parameters.radius : 2,
              kind: 'moon',
              selfRotating: false
            };
          }
        }
      }
    }
    // 知名小行星也可作为导航目标
    if (this.namedAsteroids && this.namedAsteroids.length) {
      const ast = this.namedAsteroids.find(a => a.name === name);
      if (ast) {
        return { name, mesh: ast.mesh, radius: ast.radius, kind: 'asteroid', selfRotating: false };
      }
    }
    return null;
  }

  /* ================= 主更新 ================= */

  update(dt, timeSpeed, isPaused) {
    if (!this.enabled) return;
    this._time += dt;

    if (this.navLock && this.navPhase === 'locked' && this.navTarget) {
      this._updateViewLock(dt);
    } else if (this.mode === 'nav' && this.navTarget) {
      this._updateNav(dt, isPaused);
    } else if (this.mode === 'cruise') {
      this._updateCruise(dt, isPaused);
    } else {
      this._updateHover(dt, isPaused);
    }

    // 应用位姿（渲染用平滑插值，避免轻微跳变）
    this.ship.position.lerp(this.shipState.position, 1 - Math.exp(-14 * dt));
    this.ship.quaternion.slerp(this.shipState.quaternion, 1 - Math.exp(-10 * dt));
    this.shipRenderQ.copy(this.ship.quaternion);

    // 速度估计（供 HUD 与尾焰）
    const disp = tmpV3.subVectors(this.shipState.position, this._prevPos).length() / Math.max(dt, 1e-4);
    this.displaySpeed += (disp - this.displaySpeed) * Math.min(1, dt * 6);
    this._prevPos.copy(this.shipState.position);

    // 油门 → 引擎光效
    const targetThrottle =
      this.mode === 'nav' ? (this.navPhase === 'jump' ? 1 : 0.45) : this.throttle;
    this.throttle += (targetThrottle - this.throttle) * Math.min(1, dt * 3);
    this.shipParts.setThrottle(this.throttle);

    this._updateCamera(dt);

    // 观赏锁定位置定期持久化
    if (this.navLock && this.navTarget) {
      this._saveAccum += dt;
      if (this._saveAccum > 2) {
        this._saveAccum = 0;
        this._persistViewLock();
      }
    }
  }

  /* ---------- 景观悬停 ---------- */
  _updateHover(dt, isPaused) {
    if (!isPaused) {
      this.orbitAngle += dt * 0.12;
      // 轻微悬浮起伏
      this.shipState.position.y += Math.sin(this._time * 0.8) * 0.01;
    }
    this._aimQKeep();
  }

  _aimQKeep() { /* 保持当前姿态 */ }

  /* ---------- 自由驾驶 ---------- */
  _updateCruise(dt, isPaused) {
    if (isPaused) return;
    const input = this._input || {};
    let thrust = 0;
    if (this._stickThrottle > 0) {
      // 虚拟油门：0~1 持续推力（摇杆 UI 控制）
      thrust = this._stickThrottle;
    } else {
      if (input.forward) thrust += 1;
      if (input.back) thrust -= 0.5;
    }

    // 油门与速度：转速限制与目标速度（油门杆持续推力时响应更快）
    const targetSpeed = thrust > 0
      ? this.maxCruiseSpeed * thrust * (input.boost ? 1.4 : 1)
      : thrust < 0 ? -this.maxCruiseSpeed * 0.35 : 0;
    const rate = this._stickThrottle > 0 ? this.accel * 2.2 : (thrust !== 0 ? this.accel : this.accel * 1.6);
    const cur = this._cruiseSpeed || 0;
    const next = cur + THREE.MathUtils.clamp(targetSpeed - cur, -rate * dt, rate * dt);
    this._cruiseSpeed = next;

    // 姿态输入：摇杆（模拟量）+ 键盘（开关量）叠加
    // multiply() 为本地系叠加：本地系绕 +Y 正角 = 左转、绕 +X 正角 = 低头、绕 +Z 正角 = 右翼下沉
    // 映射：右推(sx>0)右转 → yaw=-sx；上推(sy<0)抬头 → pitch=+sy；右压滚转右倾 → roll 输入取负
    const yaw = (input.yawLeft ? 1 : 0) - (input.yawRight ? 1 : 0) - this._stickX;
    const pitch = (input.pitchDown ? 1 : 0) - (input.pitchUp ? 1 : 0) + this._stickY;
    const roll = (input.rollLeft ? 1 : 0) - (input.rollRight ? 1 : 0) - this._stickRoll;

    tmpQ1.setFromAxisAngle(tmpV1.set(0, 1, 0), yaw * this.turnRate * dt);
    this.shipState.quaternion.multiply(tmpQ1);
    tmpQ1.setFromAxisAngle(tmpV1.set(1, 0, 0), pitch * this.pitchRate * dt);
    this.shipState.quaternion.multiply(tmpQ1);
    tmpQ1.setFromAxisAngle(tmpV1.set(0, 0, 1), -roll * this.rollRate * dt);
    this.shipState.quaternion.multiply(tmpQ1);

    // 前进（机头 +Z）
    tmpV2.set(0, 0, 1).applyQuaternion(this.shipState.quaternion);
    this.shipState.position.addScaledVector(tmpV2, next * dt);

    // 防止撞入太阳 / 行星
    this._collisionGuard();
  }

  /* ---------- 自动驾驶 ---------- */
  _updateNav(dt, isPaused) {
    const t = this.navTarget;
    if (!t) { this.mode = 'cruise'; return; }
    const wp = t.mesh.getWorldPosition(tmpV1.set(0, 0, 0)).clone();

    if (this.navPhase === 'jump') {
      // 跳跃段：直接飞向最佳观赏锚点（向阳面 + 太阳守卫圈外钳制），纯追踪 + 近距减速坡道
      const anchor = this._computeViewPosition(wp, t, tmpV3).clone();
      const stopDist = Math.max(t.radius * 0.4, 6);
      const remain = this.shipState.position.distanceTo(anchor) - stopDist;
      const dir = tmpV2.subVectors(anchor, this.shipState.position);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      dir.normalize();
      const dirSafe = dir.clone(); // 防止后续临时向量计算覆写共享 tmpV2

      // 机头对准目标行星（观赏朝向）
      this._aimNoseAt(wp);
      this.shipState.quaternion.copy(this._aimQ);

      // 冲刺 → 减速坡道：距离越近步长越小，平滑衔接接近段
      const step = Math.min(
        this.jumpSpeed * dt * (isPaused ? 0.15 : 1),
        Math.max(remain * 0.55, 24)
      );
      if (remain <= step) {
        this.navPhase = 'approach';
        this._navPrevWp = wp.clone();
        this._navApproachStart = this._time;
        this._navPrevDesired = null;
      } else {
        this.shipState.position.addScaledVector(dirSafe, step);
      }
      if (this._time - this._jumpStart > 18) {
        // 跳跃超时兜底：锚点被意外遮挡时强制进入接近段
        this.navPhase = 'approach';
        this._navPrevWp = wp.clone();
        this._navApproachStart = this._time;
        this._navPrevDesired = null;
      }
    } else if (this.navPhase === 'approach') {
      // 接近段：滑向最佳观赏点 + 锚点增量前馈（同时覆盖公转位移与锚点旋转，消除稳态滞后）
      const desired = this._computeViewPosition(wp, t, tmpV3).clone();
      if (!this._navPrevDesired) this._navPrevDesired = desired.clone();
      const anchorDelta = tmpV2.subVectors(desired, this._navPrevDesired);
      this._navPrevDesired.copy(desired);
      const gap = this.shipState.position.distanceTo(desired);
      const k = 1 - Math.exp(-2.2 * dt);
      this.shipState.position.lerp(desired, k).add(anchorDelta);
      this._aimNoseAt(wp);
      this.shipState.quaternion.copy(this._aimQ);

      if (gap < Math.max(t.radius * 0.12, 4) || this._time - this._navApproachStart > 15) {
        // 超时兜底：直接吸附到观赏点，防止快速目标无限追摆
        if (this._time - this._navApproachStart > 15) {
          this.shipState.position.copy(this._computeViewPosition(wp, t, tmpV3));
        }
        this._enterViewLock(wp);
      }
    }
    this._collisionGuard();
  }

  // 最佳观赏点：行星背阳侧偏外（阳光照亮 + 星空背景），距离 = radius × viewFactor
  _computeViewPosition(wp, t, out) {
    // 观赏点 = 星球向阳面外侧：始终看到被阳光照亮的半球，同时行星地表在眼前自转
    const sunPos = this.sun ? this.sun.getWorldPosition(SUN_TMP) : null;
    const dir = new THREE.Vector3();
    if (t.kind === 'star' || !sunPos || sunPos.distanceToSquared(wp) < 1e-4) {
      // 太阳目标：从当前来向观赏
      dir.subVectors(this.shipState.position, wp);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0.2);
      dir.normalize();
    } else {
      dir.subVectors(sunPos, wp).normalize();
    }
    const side = new THREE.Vector3().crossVectors(dir, UP_AXIS);
    if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
    side.normalize();

    let dist = t.radius * (t.kind === 'star' ? 2.2 : this.viewFactor) + (t.kind === 'moon' ? 6 : 0);
    // 卫星近观：半径太小（<8）时按绝对距离拉近距离，保证表面细节占满视野
    if (t.kind === 'moon' && t.radius < 8) {
      dist = Math.max(t.radius * 3.2, 9);
    }
    let yOff = t.radius * 0.45;
    let lateral = t.radius * 0.35;
    if (this.savedView && this.savedView.target === t.name) {
      dist = this.savedView.dist;
      yOff = this.savedView.yOff;
      lateral = this.savedView.lateral;
    }
    out.copy(wp).addScaledVector(dir, dist).addScaledVector(side, lateral);
    out.y += yOff;
    // 太阳守卫圈钳制：观赏点不得落在太阳碰撞守卫圈内（水星轨道在守卫圈内的兜底）
    if (this.sun && t.kind !== 'star') {
      const sunGuard = 300 * 1.3 + 12;
      const dSun = out.distanceTo(SUN_TMP);
      if (dSun < sunGuard) {
        out.sub(SUN_TMP).setLength(sunGuard).add(SUN_TMP);
      }
    }
    return out;
  }

  _enterViewLock(wp) {
    const t = this.navTarget;
    this.navPhase = 'locked';
    this.navLock = true;
    this._navPrevWp = null;
    this._navPrevDesired = null;
    this._lockPrevAnchor = null;
    // 保存该目标的最佳观赏参数（下次导航同一目标直接复用）
    if (!this.savedView || this.savedView.target !== t.name) {
      this.savedView = {
        target: t.name,
        dist: t.radius * (t.kind === 'star' ? 2.2 : this.viewFactor) + (t.kind === 'moon' ? 6 : 0),
        yOff: t.radius * 0.45,
        lateral: t.radius * 0.35
      };
    }
    this._persistViewLock();
    this.navMessage = { text: `已锁定 ${t.name} 最佳观赏点，随行星转动持续追踪`, tone: 'ok', at: Date.now() };
  }

  /* ---------- 观赏锁定：随行星公转/自转持续追踪 ---------- */
  _updateViewLock(dt) {
    const t = this.navTarget;
    if (!t) return;
    const wp = t.mesh.getWorldPosition(tmpV1);
    this._computeViewPosition(wp, t, tmpV2);
    // 锚点前馈：观赏点随行星公转/锚点几何变化而动，前馈完全跟随，锁定零滞后
    if (!this._lockPrevAnchor) this._lockPrevAnchor = tmpV2.clone();
    const anchorDelta = tmpV3.subVectors(tmpV2, this._lockPrevAnchor);
    this._lockPrevAnchor.copy(tmpV2);
    const k = 1 - Math.exp(-8 * dt);
    this.shipState.position.lerp(tmpV2, k).add(anchorDelta);
    this._aimNoseAt(wp);
    this.shipState.quaternion.slerp(this._aimQ, k);
  }

  _persistViewLock() {
    if (!this.savedView || !this.navTarget) return;
    try {
      localStorage.setItem(VIEW_LOCK_KEY, JSON.stringify(this.savedView));
    } catch (e) { /* 隐私模式下静默降级 */ }
  }

  _loadSavedView() {
    try {
      const raw = localStorage.getItem(VIEW_LOCK_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || typeof d.target !== 'string' || typeof d.dist !== 'number') return null;
      return {
        target: d.target,
        dist: d.dist,
        yOff: typeof d.yOff === 'number' ? d.yOff : 0,
        lateral: typeof d.lateral === 'number' ? d.lateral : 0
      };
    } catch (e) {
      return null;
    }
  }

  /* ---------- 安全与工具 ---------- */

  // 机头朝向目标（飞船建模机头为 +Z；非相机物体 lookAt 使 +Z 指向目标）
  _aimNoseAt(target) {
    tmpM1.lookAt(target, this.shipState.position, AIM_UP.set(0, 1, 0));
    this._aimQ = this._aimQ || new THREE.Quaternion();
    this._aimQ.setFromRotationMatrix(tmpM1);
  }

  _collisionGuard() {
    // 太阳
    if (this.sun) {
      const sp = this.sun.getWorldPosition(tmpV1.set(0, 0, 0));
      const minD = 300 * 1.3;
      const d = this.shipState.position.distanceTo(sp);
      if (d < minD) {
        const dir = tmpV2.subVectors(this.shipState.position, sp);
        if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
        dir.normalize();
        this.shipState.position.copy(sp).addScaledVector(dir, minD);
      }
    }
    // 行星
    for (const p of this.planetMeshes) {
      const wp = p.mesh.getWorldPosition(tmpV1);
      const minD = p.radius * 1.35;
      const d = this.shipState.position.distanceTo(wp);
      if (d < minD) {
        const dir = tmpV2.subVectors(this.shipState.position, wp);
        if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
        dir.normalize();
        this.shipState.position.copy(wp).addScaledVector(dir, minD);
      }
    }
  }

  /* ---------- 相机 ---------- */
  _updateCamera(dt) {
    this._camBlend = Math.min(1, this._camBlend + dt * 3);
    const cam = this.camera;
    const pos = this.ship.position; // 平滑后的渲染位姿
    const q = this.shipRenderQ;

    // 第一视角隐藏外观部件：保证透过巨型舷窗的视野无遮挡；第三视角恢复显示
    const wantExt = this.cameraMode !== 'cockpit';
    if (this.shipParts.exterior.visible !== wantExt) {
      this.shipParts.exterior.visible = wantExt;
    }
    if (this.shipParts.innerGlass && this.shipParts.innerGlass.visible === wantExt) {
      this.shipParts.innerGlass.visible = !wantExt;
    }

    if (this.cameraMode === 'cockpit') {
      // 第一视角：视点在气泡舷窗内，视线与机头一致（透过巨型舷窗观景）
      tmpV1.set(0, 1.15, 1.35).applyQuaternion(q).add(pos);
      cam.position.lerp(tmpV1, this._camBlend);
      // 相机沿 -Z 观察：叠加 180 度翻转让视线透过机头(+Z)巨型舷窗
      tmpQ1.setFromAxisAngle(tmpV1.set(0, 1, 0), Math.PI);
      tmpQ2.copy(q).multiply(tmpQ1);
      cam.quaternion.slerp(tmpQ2, this._camBlend);
      // 微弱引擎震感
      const shake = this.throttle * 0.012;
      cam.position.x += (Math.random() - 0.5) * shake;
      cam.position.y += (Math.random() - 0.5) * shake;
    } else {
      // 第三视角：环绕机位（拖动可 360° 环绕飞船），完整全貌 + 位置前馈
      tmpV1.set(
        Math.sin(this._chaseOrbit) * this._chaseDist,
        Math.sin(this._chaseElev) * this._chaseDist * 0.45 + 3.2,
        -Math.cos(this._chaseOrbit) * this._chaseDist
      ).applyQuaternion(q).add(pos);
      if (!this._chasePrevAnchor) this._chasePrevAnchor = tmpV1.clone();
      const chaseDelta = tmpV3.subVectors(tmpV1, this._chasePrevAnchor);
      this._chasePrevAnchor.copy(tmpV1);
      cam.position.lerp(tmpV1, 1 - Math.exp(-8 * dt)).add(chaseDelta);
      tmpV2.set(0, 0.6, 1.5).applyQuaternion(q).add(pos);
      tmpM1.lookAt(cam.position, tmpV2, tmpV3.set(0, 1, 0).applyQuaternion(q));
      tmpQ1.setFromRotationMatrix(tmpM1);
      cam.quaternion.slerp(tmpQ1, 1 - Math.exp(-10 * dt));
    }

    // 景观模式下相机缓慢环绕（只有 orbit 模式用）
    if (this.mode === 'orbit' && this.cameraMode === 'chase') {
      this._chasePrevAnchor = null;
      this.orbitAngle += dt * 0.1;
      const r = this.orbitRadius;
      tmpV1.set(Math.sin(this.orbitAngle) * r, 4.2, Math.cos(this.orbitAngle) * r).add(pos);
      cam.position.lerp(tmpV1, 1 - Math.exp(-2.5 * dt));
      tmpM1.lookAt(cam.position, pos, tmpV3.set(0, 1, 0));
      tmpQ1.setFromRotationMatrix(tmpM1);
      cam.quaternion.slerp(tmpQ1, 1 - Math.exp(-4 * dt));
    }

    // 近地抖动保护：确保相机不在行星内部
    this._cameraInsideGuard();
  }

  _cameraInsideGuard() {
    const check = (wp, radius) => {
      const minD = radius * 1.15;
      const d = this.camera.position.distanceTo(wp);
      if (d < minD) {
        const dir = tmpV2.subVectors(this.camera.position, wp);
        if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
        dir.normalize();
        this.camera.position.copy(wp).addScaledVector(dir, minD);
      }
    };
    if (this.sun) check(this.sun.getWorldPosition(tmpV1), 300);
    for (const p of this.planetMeshes) {
      check(p.mesh.getWorldPosition(tmpV1), p.radius);
    }
  }

  /* ---------- 键盘输入（由 React 层挂接） ---------- */
  attachInput(dom) {
    this._input = {};
    const map = {
      'KeyW': 'forward', 'KeyS': 'back',
      'KeyA': 'yawLeft', 'KeyD': 'yawRight',
      'ArrowUp': 'pitchUp', 'ArrowDown': 'pitchDown',
      'ArrowLeft': 'yawLeft', 'ArrowRight': 'yawRight',
      'KeyQ': 'rollLeft', 'KeyE': 'rollRight',
      'ShiftLeft': 'boost'
    };
    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      if (e.code === 'KeyV') { this.toggleCameraMode(); return; }
      if (e.code === 'KeyC') { this.toggleConsole(); return; }
      const k = map[e.code];
      if (k) {
        this._input[k] = true;
        if (e.code.startsWith('Arrow')) e.preventDefault();
        if (['forward', 'back', 'yawLeft', 'yawRight', 'pitchUp', 'pitchDown'].includes(k)) {
          this._engageManual();
        }
      }
    };
    this._onKeyUp = (e) => {
      const k = map[e.code];
      if (k) this._input[k] = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this._inputDom = dom;
  }

  detachInput() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this._input = {};
  }

  /* ---------- 虚拟摇杆接口（React UI 调用） ---------- */

  setStick(x, y) {
    this._stickX = THREE.MathUtils.clamp(x, -1, 1);
    this._stickY = THREE.MathUtils.clamp(y, -1, 1);
    this._engageManual();
  }

  setStickRoll(v) {
    this._stickRoll = THREE.MathUtils.clamp(v, -1, 1);
    this._engageManual();
  }

  setStickThrottle(v) {
    this._stickThrottle = THREE.MathUtils.clamp(v, 0, 1);
    this._engageManual();
  }

  // 手动输入自动接管：摇杆/油门/键盘任一有效输入时，从悬停或自动驾驶切入自由驾驶
  _engageManual() {
    if (this.mode === 'cruise') return;
    const engaged =
      Math.abs(this._stickX) > 0.15 ||
      Math.abs(this._stickY) > 0.15 ||
      Math.abs(this._stickRoll) > 0.15 ||
      this._stickThrottle > 0.06;
    if (engaged) this.setFlightMode('cruise');
  }

  getChaseOrbit() {
    return { orbit: this._chaseOrbit, elev: this._chaseElev, dist: this._chaseDist };
  }

  orbitChase(dTheta, dElev) {
    this._chaseOrbit += dTheta;
    this._chaseElev = THREE.MathUtils.clamp(this._chaseElev + dElev, -0.55, 0.85);
    this._chasePrevAnchor = null;
  }

  zoomChase(factor) {
    this._chaseDist = THREE.MathUtils.clamp(this._chaseDist * factor, 16, 90);
    this._chasePrevAnchor = null;
  }

  /* ---------- HUD 状态 ---------- */
  getHudState() {
    const msg = this.navMessage && Date.now() - this.navMessage.at < 4000 ? this.navMessage : null;
    return {
      mode: this.mode,
      cameraMode: this.cameraMode,
      navPhase: this.navPhase,
      navTarget: this.navTarget ? this.navTarget.name : null,
      navLock: this.navLock,
      speed: Math.round(this.displaySpeed),
      throttle: Math.round(this.throttle * 100),
      consoleVisible: this.consoleVisible,
      message: msg ? msg.text : null,
      tone: msg ? msg.tone : null
    };
  }

  clearMessage() {
    this.navMessage = null;
  }

  dispose() {
    this.detachInput();
    this.scene.remove(this.ship);
    this.ship.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
