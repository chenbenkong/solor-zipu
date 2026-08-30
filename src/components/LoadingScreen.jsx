import React from 'react';

export function LoadingScreen({ visible, progress = 0 }) {
  if (!visible) return null;

  return (
    <div className="loading-screen">
      <div className="loading-orbit">
        <span className="loading-planet" />
      </div>
      <div className="loading-title">太阳系 3D 模拟</div>
      <div className="loading-sub">正在点亮星辰…</div>
      <div className="loading-bar">
        <div className="loading-bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
    </div>
  );
}
