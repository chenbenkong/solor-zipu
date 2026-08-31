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
export function CockpitHud({ hud, onModeChange, onNavSelect, onToggleCamera, onToggleConsole, onCancelNav, onExit, planets }) {
  const [navOpen, setNavOpen] = useState(false);
  const hudRef = useRef(hud);
  useEffect(() => { hudRef.current = hud; }, [hud]);

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

      {/* 一次性系统提示 */}
      {hud && hud.message && (
        <div className={'cockpit-toast ' + (hud.tone || 'info')}>{hud.message}</div>
      )}

      {/* 第一视角下的操作提示 */}
      {hud && hud.cameraMode === 'cockpit' && (
        <div className="cockpit-hint">
          <span>W/S 油门</span><span>A/D 转向</span><span>方向键 俯仰</span>
          <span>Q/E 滚转</span><span>V 切换视角</span><span>C 收起控制台</span>
        </div>
      )}
    </div>
  );
}
