import React, { useState } from 'react';
import { Icon } from './Icon';

function ToggleButton({ active, onClick, children, label }) {
  return (
    <button className={`setting-toggle${active ? ' active' : ''}`} onClick={onClick} aria-pressed={active}>
      <span>{label || children}</span>
      <span className="toggle-indicator"><span /></span>
    </button>
  );
}

export const ControlPanel = React.memo(function ControlPanel({
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
  onResetSimulationTime,
  onToggleMusic,
  onBlackHole,
  onEnterShip
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {settingsOpen && (
        <section className="control-settings" aria-label="观测设置">
          <div className="settings-header">
            <div>
              <span className="eyebrow">OBSERVATION DECK</span>
              <h2>观测设置</h2>
            </div>
            <button className="icon-btn" onClick={() => setSettingsOpen(false)} aria-label="收起设置">
              <Icon name="close" size={17} />
            </button>
          </div>
          <div className="settings-zoom">
            <label htmlFor="zoomControl"><Icon name="expand" size={15} /> 场景缩放</label>
            <span>{globalScale.toFixed(1)}×</span>
            <input
              type="range"
              id="zoomControl"
              min="0.5"
              max="3"
              step="0.1"
              value={globalScale}
              onChange={(event) => onZoomChange(Number(event.target.value))}
            />
          </div>
          <div className="settings-time">
            <div className="settings-section-head">
              <span>时间控制</span>
              <button className="today-reset" onClick={onResetSimulationTime}>
                <Icon name="reset" size={13} /> 返回今日
              </button>
            </div>
            <div className="time-presets" aria-label="时间流速预设">
              {[0.5, 1, 3, 5, 10].map(speed => (
                <button
                  key={speed}
                  className={`time-preset${Math.abs(timeSpeed - speed) < 0.001 ? ' active' : ''}`}
                  onClick={() => onSpeedChange(speed)}
                >
                  {speed.toFixed(speed % 1 ? 1 : 0)}×
                </button>
              ))}
            </div>
            <p className="time-note">1× 约等于每秒推进 1 个地球日，供快速观测季节与相位变化。</p>
          </div>
          <div className="settings-grid">
            <ToggleButton active={showOrbits} onClick={onToggleOrbits} label="行星轨道" />
            <ToggleButton active={showStars} onClick={onToggleStars} label="深空星场" />
            <ToggleButton active={showNames} onClick={onToggleNames} label="天体名称" />
            <ToggleButton active={showBloom} onClick={onToggleBloom} label="电影辉光" />
            <ToggleButton active={showLensFlare} onClick={onToggleLensFlare} label="镜头光晕" />
            <ToggleButton active={isMusicPlaying} onClick={onToggleMusic} label="深空声景" />
          </div>
          <div className="quality-note"><Icon name="gauge" size={14} /> 自适应画质已启用，优先保持流畅</div>
        </section>
      )}

      <div className="controls" role="toolbar" aria-label="太阳系观测控制">
        <div className="control-buttons primary-controls">
          <button
            className={`control-icon play-control${isPaused ? ' active' : ''}`}
            onClick={onTogglePause}
            aria-label={isPaused ? '继续模拟' : '暂停模拟'}
            title={isPaused ? '继续 (Space)' : '暂停 (Space)'}
          >
            <Icon name={isPaused ? 'play' : 'pause'} size={18} />
          </button>
          <button className="control-icon reset-control" onClick={onResetView} aria-label="重置视角" title="重置视角">
            <Icon name="reset" size={17} />
          </button>
        </div>

        <div className="control-divider" />
        <div className="slider-row speed-row">
          <label htmlFor="speedControl">时间</label>
          <input
            type="range"
            id="speedControl"
            min="0"
            max="10"
            step="0.1"
            value={timeSpeed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            style={{ '--range-progress': `${timeSpeed * 10}%` }}
          />
          <output className="slider-value" htmlFor="speedControl">{timeSpeed.toFixed(1)}<small>×</small></output>
        </div>

        <div className="control-divider secondary-divider" />
        <div className="control-toggles desktop-toggles">
          <button className={`minimal-toggle${showOrbits ? ' active' : ''}`} onClick={onToggleOrbits} aria-pressed={showOrbits}>轨道</button>
          <button className={`minimal-toggle${showNames ? ' active' : ''}`} onClick={onToggleNames} aria-pressed={showNames}>标签</button>
        </div>

        <button
          className={`control-icon settings-control${settingsOpen ? ' active' : ''}`}
          onClick={() => setSettingsOpen((open) => !open)}
          aria-label="观测设置"
          aria-expanded={settingsOpen}
          title="观测设置"
        >
          <Icon name="settings" size={18} />
        </button>
        <button className="text-control blackhole-control" onClick={onBlackHole} title="进入 Gargantua 黑洞">
          <Icon name="blackhole" size={17} /> <span className="action-label">黑洞</span>
        </button>
        <button className="ship-launch" onClick={onEnterShip} title="登上星舰">
          <Icon name="rocket" size={17} />
          <span className="action-label">星舰出航</span>
          <Icon name="arrow" size={15} className="launch-arrow" />
        </button>
      </div>
    </>
  );
});
