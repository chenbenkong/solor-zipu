import React, { useEffect, useRef, useState } from 'react';

/**
 * 星隼号 ZF-77 驾驶舱 HUD —— 第一视角舱内界面
 * Territory Studio FUI 风格：琥珀/青色全息投影、多层数据流、可信的未来感
 *
 * 布局（第一视角内）：
 *  - 巨型透明舷窗相框（上沿与两侧圆弧边框，视觉上包裹 3D 舷窗，中央全透明可观景）
 *  - 底部全息控制台：可点击收起/展开；内含 飞行模式 / 导航目标 / 视角切换 / 速度条
 *  - 顶部状态条：速度 / 目标 / 锁定状态 / 模式
 */
export function CockpitHud({ hud, onModeChange, onNavSelect, onToggleCamera, onToggleConsole, onCancelNav, onExit, onStick, onStickRoll, onStickThrottle, onOrbit, planets }) {
  const [navOpen, setNavOpen] = useState(false);
  const hudRef = useRef(hud);
  useEffect(() => { hudRef.current = hud; }, [hud]);

  /* ---------- 虚拟摇杆（鼠标/触屏通用） ---------- */
  const stickRef = useRef(null);
  const stickState = useRef({ active: false, cx: 0, cy: 0, r: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false });

  const stickStart = (e) => {
    const el = stickRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    stickState.current = { active: true, cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2 };
    // 挂到 window：快速拖出摇杆盘也不丢事件
    window.addEventListener('mousemove', stickMove);
    window.addEventListener('mouseup', stickEnd);
    stickMove(e);
  };
  const stickMove = (e) => {
    const st = stickState.current;
    if (!st.active) return;
    const pt = e.touches ? e.touches[0] : e;
    const dx = (pt.clientX - st.cx) / st.r;
    const dy = (pt.clientY - st.cy) / st.r;
    const len = Math.hypot(dx, dy);
    const k = len > 1 ? 1 / len : 1;
    const nx = dx * k, ny = dy * k;
    setKnob({ x: nx, y: ny, on: true });
    onStick(nx, ny);
    // 摇杆左右推到底时附加滚转（空战手感）
    onStickRoll(Math.abs(nx) > 0.92 ? nx * 0.8 : 0);
  };
  const stickEnd = () => {
    window.removeEventListener('mousemove', stickMove);
    window.removeEventListener('mouseup', stickEnd);
    stickState.current.active = false;
    setKnob({ x: 0, y: 0, on: false });
    onStick(0, 0);
    onStickRoll(0);
  };

  /* ---------- 虚拟油门杆（右侧上下拖动） ---------- */
  const [throttle, setThrottle] = useState(0);
  const thrRef = useRef(null);
  const thrState = useRef({ active: false, h: 0, top: 0 });
  const thrStart = (e) => {
    const el = thrRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    thrState.current = { active: true, h: r.height - 26, top: r.top };
    window.addEventListener('mousemove', thrMove);
    window.addEventListener('mouseup', thrEnd);
    thrMove(e);
  };
  const thrMove = (e) => {
    const st = thrState.current;
    if (!st.active) return;
    const pt = e.touches ? e.touches[0] : e;
    const v = 1 - (pt.clientY - st.top - 13) / st.h;
    const clamped = Math.max(0, Math.min(1, v));
    setThrottle(clamped);
    onStickThrottle(clamped);
  };
  const thrEnd = () => {
    window.removeEventListener('mousemove', thrMove);
    window.removeEventListener('mouseup', thrEnd);
    thrState.current.active = false;
  };

  /* ---------- 第三视角环绕拖拽（在画布上拖动可 360° 环绕） ---------- */
  useEffect(() => {
    if (!hud || hud.cameraMode !== 'chase') return;
    let dragging = false, lx = 0, ly = 0;
    const down = (e) => { if (e.button === 0) { dragging = true; lx = e.clientX; ly = e.clientY; } };
    const move = (e) => {
      if (!dragging) return;
      onOrbit((e.clientX - lx) * 0.008, -(e.clientY - ly) * 0.005);
      lx = e.clientX; ly = e.clientY;
    };
    const up = () => { dragging = false; };
    const wheel = (e) => { onOrbit(0, 0, e.deltaY > 0 ? 1.08 : 0.93); };
    const canvas = document.querySelector('.canvas-container canvas');
    if (!canvas) return;
    canvas.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    canvas.addEventListener('wheel', wheel, { passive: true });
    return () => {
      canvas.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [hud, onOrbit]);

  const active = hud && hud.mode === 'nav' && hud.navTarget;

  // 键盘：空格自由驾驶 / 回车自动驾驶到当前目标（由全局键盘统一处理）

  const renderNavList = () => (
    <div className="cockpit-nav-list">
      {planets.map(p => (
        <button
          key={p}
          className={'cockpit-nav-item' + (hud && hud.navTarget === p ? ' active' : '')}
          onClick={() => { onNavSelect(p); setNavOpen(false); }}
        >
          <span className="cockpit-nav-dot" />
          {p}
        </button>
      ))}
    </div>
  );

  return (
    <div className="cockpit-hud" data-cameramode={hud ? hud.cameraMode : 'chase'}>
      {/* 退出飞船模式 */}
      <button className="cockpit-exit" onClick={onExit} title="退出飞船模式 (Esc)">✕ 退出飞船</button>

      {/* 左下虚拟摇杆：拖动控制转向/俯仰（鼠标+触屏） */}
      <div
        ref={stickRef}
        className={'virt-stick' + (knob.on ? ' active' : '')}
        onMouseDown={stickStart}
        onTouchStart={stickStart}
        onTouchMove={stickMove}
        onTouchEnd={stickEnd}
      >
        <div className="vs-ring" />
        <div className="vs-cross" />
        <div className="vs-knob" style={{ transform: `translate(${knob.x * 30}px, ${knob.y * 30}px)` }} />
        <span className="vs-label">操纵杆</span>
      </div>

      {/* 右下虚拟油门杆：上推加速 / 下拉减速 */}
      <div
        ref={thrRef}
        className="virt-throttle"
        onMouseDown={thrStart}
        onTouchStart={thrStart}
        onTouchMove={thrMove}
        onTouchEnd={thrEnd}
      >
        <div className="vt-track">
          <div className="vt-fill" style={{ height: (throttle * 100) + '%' }} />
          <div className="vt-handle" style={{ bottom: (throttle * 100) + '%' }} />
        </div>
        <span className="vt-label">油门 {Math.round(throttle * 100)}%</span>
      </div>

      {/* 巨型透明舷窗相框：第一视角可见，中央透明可观景 */}
      <div className="viewport-frame">
        <div className="vf-corner vf-tl" />
        <div className="vf-corner vf-tr" />
        <div className="vf-corner vf-bl" />
        <div className="vf-corner vf-br" />
        <div className="vf-edge vf-top" />
        <div className="vf-edge vf-bottom" />
        <div className="vf-edge vf-left" />
        <div className="vf-edge vf-right" />
        <div className="vf-tick vf-tick-1" />
        <div className="vf-tick vf-tick-2" />
        <div className="vf-tick vf-tick-3" />
        <div className="vf-tick vf-tick-4" />
        <div className="vf-readout vf-readout-l">
          <span>ZF-77 星隼号</span>
          <span>舷窗结构 · 透明复合装甲</span>
        </div>
        <div className="vf-readout vf-readout-r">
          <span>观测窗 FRAME-01</span>
          <span>透光率 96.8%</span>
        </div>
        {/* 瞄准环：机头朝向指示 */}
        <div className="cockpit-reticle">
          <div className="reticle-ring" />
          <div className="reticle-dot" />
        </div>
      </div>

      {/* 顶部状态条 */}
      <div className="cockpit-statusbar">
        <div className="cs-block cs-mode">
          <span className="cs-label">飞行模式</span>
          <span className="cs-value" data-mode={hud ? hud.mode : 'orbit'}>
            {hud && hud.mode === 'nav' ? '自动驾驶' : hud && hud.mode === 'cruise' ? '自由驾驶' : '景观悬停'}
          </span>
        </div>
        <div className="cs-block cs-target">
          <span className="cs-label">导航目标</span>
          <span className="cs-value">{hud && hud.navTarget ? hud.navTarget : '—'}</span>
        </div>
        <div className="cs-block cs-lock">
          <span className="cs-label">观赏锁定</span>
          <span className="cs-value" data-lock={hud && hud.navLock ? 'on' : 'off'}>
            {hud && hud.navLock ? '已锁定 · 追踪中' : '未锁定'}
          </span>
        </div>
        <div className="cs-block cs-view">
          <span className="cs-label">视角</span>
          <span className="cs-value">{hud && hud.cameraMode === 'cockpit' ? '舱内第一视角' : '舱外第三视角'}</span>
        </div>
      </div>

      {/* 底部全息控制台（可收起） */}
      <div className={'cockpit-console' + (hud && !hud.consoleVisible ? ' collapsed' : '')}>
        <button
          className="console-toggle"
          onClick={onToggleConsole}
          title="收起 / 展开控制台 (C)"
        >
          <span className="ct-chevron">{hud && hud.consoleVisible ? '▾' : '▸'}</span>
          <span className="ct-text">{hud && hud.consoleVisible ? '收起控制台' : '展开控制台'}</span>
        </button>

        {hud && hud.consoleVisible && (
          <>
            <div className="console-panel">
              <div className="cp-section">
                <div className="cp-title">飞行模式</div>
                <div className="cp-buttons">
                  <button
                    className={'cp-btn' + (hud.mode === 'cruise' ? ' active' : '')}
                    onClick={() => onModeChange('cruise')}
                    title="W/S 油门 · A/D 转向 · 方向键俯仰 · Q/E 滚转"
                  >自由驾驶</button>
                  <button
                    className={'cp-btn' + (hud.mode === 'orbit' ? ' active' : '')}
                    onClick={() => onModeChange('orbit')}
                  >景观悬停</button>
                </div>
              </div>

              <div className="cp-section">
                <div className="cp-title">自动导航</div>
                <div className="cp-nav-wrap">
                  <button className="cp-btn cp-nav-toggle" onClick={() => setNavOpen(o => !o)}>
                    选择星球 ▾
                  </button>
                  {navOpen && renderNavList()}
                </div>
                {active && (
                  <button className="cp-btn cp-cancel" onClick={onCancelNav}>解除自动驾驶</button>
                )}
              </div>

              <div className="cp-section">
                <div className="cp-title">视角</div>
                <div className="cp-buttons">
                  <button
                    className={'cp-btn' + (hud.cameraMode === 'cockpit' ? ' active' : '')}
                    onClick={() => onToggleCamera('cockpit')}
                  >舱内第一视角</button>
                  <button
                    className={'cp-btn' + (hud.cameraMode === 'chase' ? ' active' : '')}
                    onClick={() => onToggleCamera('chase')}
                  >舱外第三视角</button>
                </div>
              </div>

              <div className="cp-section cp-speed">
                <div className="cp-title">速度</div>
                <div className="speed-bar">
                  <div className="speed-fill" style={{ width: Math.min(100, (hud.speed / 2500) * 100) + '%' }} />
                </div>
                <div className="speed-readout">
                  <span className="sr-num">{hud.speed}</span>
                  <span className="sr-unit">u/s</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 第三视角提示（拖动环绕） */}
      {hud && hud.cameraMode === 'chase' && (
        <div className="chase-orbit-hint">拖动画面 360° 环绕飞船 · 滚轮缩放</div>
      )}

      {/* 一次性系统提示 */}
      {hud && hud.message && (
        <div className={'cockpit-toast ' + (hud.tone || 'info')}>{hud.message}</div>
      )}

      {/* 第一视角下的操作提示 */}
      {hud && hud.cameraMode === 'cockpit' && (
        <div className="cockpit-hint">
          <span>摇杆/拖动 转向俯仰</span><span>油门杆 加减速</span><span>W/S 油门</span>
          <span>V 切换视角</span><span>C 收起控制台</span><span>第三视角：拖动 360° 环绕 · 滚轮缩放</span>
        </div>
      )}
    </div>
  );
}
