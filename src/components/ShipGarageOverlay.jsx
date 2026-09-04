import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ShipGarageScene, SHIP_VARIANTS } from '../three/ship/ShipGarageScene.js';

/**
 * 星舰机库覆盖层：简约白色超科幻展厅
 * 选型 + 检视（组合360° / 爆炸拆解 / 舱内漫游）全部在此完成
 */
export function ShipGarageOverlay({ currentShipId, onConfirm, onExit }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const [selectedId, setSelectedId] = useState(currentShipId || 'falcon');
  const [mode, setMode] = useState('assembled');
  const [explode, setExplode] = useState(0);
  const [partCount, setPartCount] = useState(0);
  const selected = SHIP_VARIANTS.find(v => v.id === selectedId) || SHIP_VARIANTS[0];

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let gs = null;
    try {
      gs = new ShipGarageScene(containerRef.current);
      gs.init();
      gs.loadShip(currentShipId || 'falcon');
      sceneRef.current = gs;
    } catch (e) {
      console.error('[garage] 初始化失败：', e);
    }
    const onKey = (ev) => {
      if (ev.code === 'Escape') onExit();
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
    setExplode(0);
    if (sceneRef.current) {
      sceneRef.current.loadShip(id);
      sceneRef.current.setMode(mode);
      if (mode === 'exploded') {
        sceneRef.current.setExplodeFactor(1);
        setTimeout(() => sceneRef.current && setPartCount(sceneRef.current.partCount), 400);
      }
    }
  }, [mode]);

  const changeMode = useCallback((m) => {
    setMode(m);
    if (!sceneRef.current) return;
    sceneRef.current.setMode(m);
    if (m === 'exploded') {
      setExplode(100);
      setTimeout(() => sceneRef.current && setPartCount(sceneRef.current.partCount), 400);
    } else {
      setExplode(0);
    }
  }, []);

  const changeExplode = useCallback((v) => {
    setExplode(v);
    sceneRef.current?.setExplodeFactor(v / 100);
  }, []);

  return (
    <div className="garage-overlay garage-light">
      <div ref={containerRef} className="garage-canvas-container" />

      {/* 顶部标题 */}
      <header className="garage-header">
        <div className="garage-kicker">VESSEL BAY · 星舰机库</div>
        <h1 className="garage-title">选择你的座舰</h1>
      </header>

      {/* 左侧：检视模式页签（竖排） */}
      <nav className="garage-modes">
        <button className={'garage-mode' + (mode === 'assembled' ? ' active' : '')} onClick={() => changeMode('assembled')}>
          <span className="garage-mode-ico">◎</span>
          <span>组合 360°</span>
        </button>
        <button className={'garage-mode' + (mode === 'exploded' ? ' active' : '')} onClick={() => changeMode('exploded')}>
          <span className="garage-mode-ico">⬡</span>
          <span>爆炸拆解</span>
        </button>
        <button className={'garage-mode' + (mode === 'interior' ? ' active' : '')} onClick={() => changeMode('interior')}>
          <span className="garage-mode-ico">◫</span>
          <span>舱内漫游</span>
        </button>
        {mode === 'exploded' && (
          <div className="garage-explode-ctl">
            <span className="garage-explode-label">拆解度 {explode}%</span>
            <input
              type="range" min="0" max="100" value={explode}
              onChange={(e) => changeExplode(parseFloat(e.target.value))}
            />
            <span className="garage-part-count">{partCount} 部件</span>
          </div>
        )}
        <div className="garage-mode-hint">
          {mode === 'interior' ? '拖拽环视 · W/A/S/D 舱内移动'
            : mode === 'exploded' ? '拖拽旋转 · 滚轮缩放 · 悬停部件查看名称'
            : '拖拽旋转 · 滚轮缩放'}
        </div>
      </nav>

      {/* 右侧：机型列表 */}
      <aside className="garage-fleet">
        <div className="garage-fleet-title">FLEET · 舰队列</div>
        {SHIP_VARIANTS.map(v => (
          <button
            key={v.id}
            className={'garage-fleet-item' + (v.id === selectedId ? ' active' : '')}
            onClick={() => select(v.id)}
          >
            <span className="garage-fleet-dot" style={{ background: v.color }} />
            <span className="garage-fleet-name">{v.name}</span>
            <span className="garage-fleet-en">{v.en}</span>
          </button>
        ))}
      </aside>

      {/* 底部：选中机型信息 + 出击 */}
      <div className="garage-dock">
        <div className="garage-info">
          <div className="garage-ship-name" style={{ color: selected.color }}>
            {selected.name}
            <span className="garage-ship-en">{selected.en}</span>
          </div>
          <div className="garage-ship-role">{selected.role}</div>
          <p className="garage-ship-desc">{selected.desc}</p>
        </div>
        <div className="garage-actions">
          <button className="garage-confirm" onClick={() => onConfirm(selectedId)}>
            ⬡ 以此舰出击
          </button>
          <button className="garage-back" onClick={onExit}>← 返回飞船 (ESC)</button>
        </div>
      </div>
    </div>
  );
}
