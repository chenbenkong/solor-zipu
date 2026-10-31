import React from 'react';
import { Icon } from './Icon';

export const Header = React.memo(function Header({ speedLevel, isPaused, onEnterShip, onBlackHole, onGuide }) {
  return (
    <header className="app-header">
      <a className="brand" href="./" aria-label="SOLARIS 太阳系首页">
        <span className="brand-mark"><Icon name="orbit" size={27} strokeWidth={1.35} /></span>
        <span className="brand-copy">
          <span className="brand-name">SOLARIS<span className="brand-period">.</span></span>
          <span className="brand-subtitle">太阳系交互星图</span>
        </span>
      </a>

      <nav className="mode-switch" aria-label="探索模式">
        <button className="mode-tab active" aria-current="page">
          <Icon name="orbit" size={15} /> 观测
        </button>
        <button className="mode-tab" onClick={onEnterShip}>
          <Icon name="rocket" size={15} /> 星舰
        </button>
        <button className="mode-tab" onClick={onBlackHole}>
          <Icon name="blackhole" size={15} /> 黑洞
        </button>
      </nav>

      <div className="header-actions">
        <div className="live-status" title={`时间流速 ${speedLevel.toFixed(1)} 倍`}>
          <span className={`status-pulse${isPaused ? ' paused' : ''}`} />
          <span>{isPaused ? '时间已暂停' : '实时模拟'}</span>
          <span className="live-speed">{speedLevel.toFixed(1)}×</span>
        </div>
        <button className="icon-btn guide-btn" onClick={onGuide} aria-label="打开使用指南" title="使用指南">
          <Icon name="info" size={19} />
        </button>
      </div>
    </header>
  );
});
