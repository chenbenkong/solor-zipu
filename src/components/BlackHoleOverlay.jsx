import React, { useEffect, useRef, useState } from 'react';
import { BlackHoleExperience } from '../three/blackhole/BlackHoleExperience.js';

// 全屏黑洞体验覆盖层：挂载时启动测地线渲染，卸载时彻底释放
export function BlackHoleOverlay({ onExit }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let exp = null;
    try {
      exp = new BlackHoleExperience(containerRef.current);
      exp.init();
      setReady(true);
    } catch (e) {
      setErr(String((e && e.message) || e));
    }
    const onKey = (ev) => { if (ev.code === 'Escape') onExit(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (exp) exp.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bh-overlay">
      <div ref={containerRef} className="bh-canvas-container" />
      <button className="bh-back-btn" onClick={onExit}>← 返回太阳系 (ESC)</button>
      {!ready && !err && <div className="bh-loading">正在进入黑洞视界…</div>}
      {err && <div className="bh-error">初始化失败：{err}</div>}
    </div>
  );
}
