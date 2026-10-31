import React from 'react';

export function LoadingScreen({ visible, progress = 0 }) {
  if (!visible) return null;
  const value = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-brand"><span className="brand-period">SOLARIS.</span><span>INTERACTIVE STAR ATLAS</span></div>
      <div className="loading-universe" aria-hidden="true">
        <span className="loading-orbit orbit-one"><i /></span>
        <span className="loading-orbit orbit-two"><i /></span>
        <span className="loading-sun" />
      </div>
      <div className="loading-title">正在构建你的宇宙</div>
      <div className="loading-sub">CALIBRATING CELESTIAL BODIES</div>
      <div className="loading-progress-row"><span>载入星图</span><strong>{String(value).padStart(2, '0')}%</strong></div>
      <div className="loading-bar"><div className="loading-bar-fill" style={{ width: `${value}%` }} /></div>
      <p className="loading-tip">每一段伟大的探索，都始于仰望。</p>
    </div>
  );
}
