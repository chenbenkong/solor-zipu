import React from 'react';

export function ControlPanel({
  isPaused,
  timeSpeed,
  showOrbits,
  showStars,
  showNames,
  showBloom,
  showLensFlare,
  globalScale,
  isMusicPlaying,
  onTogglePause,
  onSpeedChange,
  onZoomChange,
  onToggleOrbits,
  onToggleStars,
  onToggleNames,
  onToggleBloom,
  onToggleLensFlare,
  onResetView,
  onToggleMusic,
  onBlackHole
}) {
  return (
    <div className="controls">
      <div className="control-group">
        <div className="slider-row">
          <label htmlFor="speedControl">速度</label>
          <input
            type="range"
            id="speedControl"
            min="0"
            max="10"
            step="0.1"
            value={timeSpeed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          />
          <span className="slider-value">{timeSpeed.toFixed(1)}×</span>
        </div>
        <div className="slider-row">
          <label htmlFor="zoomControl">缩放</label>
          <input
            type="range"
            id="zoomControl"
            min="0.5"
            max="3.0"
            step="0.1"
            value={globalScale}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          />
          <span className="slider-value">{globalScale.toFixed(1)}×</span>
        </div>
      </div>

      <div className="control-group control-buttons">
        <button className={isPaused ? 'ctrl-btn active' : 'ctrl-btn'} onClick={onTogglePause}>
          {isPaused ? '▶ 播放' : '⏸ 暂停'}
        </button>
        <button className="ctrl-btn" onClick={onResetView}>⟲ 重置</button>
        <button className="ctrl-btn bh-btn" onClick={onBlackHole} title="进入 GARGANTUA 黑洞">◉ 探索黑洞</button>
      </div>

      <div className="control-group control-toggles">
        <button className={showOrbits ? 'toggle-btn active' : 'toggle-btn'} onClick={onToggleOrbits}>
          轨道
        </button>
        <button className={showStars ? 'toggle-btn active' : 'toggle-btn'} onClick={onToggleStars}>
          星空
        </button>
        <button className={showNames ? 'toggle-btn active' : 'toggle-btn'} onClick={onToggleNames}>
          名称
        </button>
        <button className={showBloom ? 'toggle-btn active' : 'toggle-btn'} onClick={onToggleBloom}>
          辉光
        </button>
        <button className={showLensFlare ? 'toggle-btn active' : 'toggle-btn'} onClick={onToggleLensFlare}>
          光晕
        </button>
        <button className={isMusicPlaying ? 'toggle-btn active' : 'toggle-btn'} onClick={onToggleMusic}>
          {isMusicPlaying ? '♪ 静音' : '♪ 音乐'}
        </button>
      </div>
    </div>
  );
}
