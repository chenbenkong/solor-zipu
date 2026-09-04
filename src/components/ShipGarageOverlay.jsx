import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ShipGarageScene, SHIP_VARIANTS } from '../three/ship/ShipGarageScene.js';

// 星舰机库覆盖层：独立超空间选型界面（数据坞里的全息舰桥）
export function ShipGarageOverlay({ currentShipId, onConfirm, onExit }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const [selectedId, setSelectedId] = useState(currentShipId || 'falcon');
  const [ready, setReady] = useState(false);
  const selected = SHIP_VARIANTS.find(v => v.id === selectedId) || SHIP_VARIANTS[0];

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let gs = null;
    try {
      gs = new ShipGarageScene(containerRef.current);
      gs.init();
      gs.loadShip(currentShipId || 'falcon');
      sceneRef.current = gs;
      setReady(true);
    } catch (e) {
      console.error('[garage] 初始化失败：', e);
    }
    const onKey = (ev) => {
      if (ev.code === 'Escape') onExit();
      if (ev.code === 'ArrowLeft') step(-1);
      if (ev.code === 'ArrowRight') step(1);
      if (ev.code === 'Enter') onConfirm(selectedId);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (gs) gs.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback((id) => {
    setSelectedId(id);
    if (sceneRef.current) sceneRef.current.loadShip(id);
  }, []);

  const step = useCallback((d) => {
    const idx = SHIP_VARIANTS.findIndex(v => v.id === selectedId);
    const next = (idx + d + SHIP_VARIANTS.length) % SHIP_VARIANTS.length;
    select(SHIP_VARIANTS[next].id);
  }, [selectedId, select]);

  return (
    <div className="garage-overlay">
      <div ref={containerRef} className="garage-canvas-container" />

      {/* 顶部标题 */}
      <header className="garage-header">
        <div className="garage-kicker">VESSEL BAY · 星舰机库</div>
        <h1 className="garage-title">选择你的座舰</h1>
      </header>

      {/* 左右切换箭头 */}
      <button className="garage-arrow left" onClick={() => step(-1)} title="上一艘 (←)">‹</button>
      <button className="garage-arrow right" onClick={() => step(1)} title="下一艘 (→)">›</button>

      {/* 底部机型信息栏 */}
      <div className="garage-dock">
        <div className="garage-info">
          <div className="garage-ship-name" style={{ color: selected.color }}>
            {selected.name}
            <span className="garage-ship-en">{selected.en}</span>
          </div>
          <div className="garage-ship-role">{selected.role}</div>
          <p className="garage-ship-desc">{selected.desc}</p>
        </div>
        {/* 机型选择卡片 */}
        <div className="garage-cards">
          {SHIP_VARIANTS.map(v => (
            <button
              key={v.id}
              className={'garage-card' + (v.id === selectedId ? ' active' : '')}
              style={{ '--ship-color': v.color }}
              onClick={() => select(v.id)}
            >
              <span className="garage-card-dot" style={{ background: v.color }} />
              <span className="garage-card-name">{v.name}</span>
              <span className="garage-card-en">{v.en}</span>
            </button>
          ))}
        </div>
        <div className="garage-actions">
          <button className="garage-confirm" onClick={() => onConfirm(selectedId)}>
            ⬡ 以此舰出击 · 进入结构检视
          </button>
          <button className="garage-back" onClick={onExit}>← 返回飞船 (ESC)</button>
        </div>
      </div>

      {!ready && <div className="garage-loading">正在展开全息机库…</div>}
    </div>
  );
}
