import React from 'react';
import { Icon } from './Icon';

const THUMB_MAP = {
  '太阳': 'textures/thumbs/sun.webp',
  '月球': 'textures/thumbs/moon.webp',
  '水星': 'textures/thumbs/mercury.webp',
  '金星': 'textures/thumbs/venus_atmosphere.webp',
  '地球': 'textures/thumbs/earth.webp',
  '火星': 'textures/thumbs/mars.webp',
  '木星': 'textures/thumbs/jupiter.webp',
  '土星': 'textures/thumbs/saturn.webp',
  '天王星': 'textures/thumbs/uranus.webp',
  '海王星': 'textures/thumbs/neptune.webp',
  '冥王星': 'textures/thumbs/pluto.webp'
};

const ENGLISH_NAMES = {
  '太阳': 'SUN', '水星': 'MERCURY', '金星': 'VENUS', '地球': 'EARTH',
  '火星': 'MARS', '木星': 'JUPITER', '土星': 'SATURN', '天王星': 'URANUS',
  '海王星': 'NEPTUNE', '冥王星': 'PLUTO', '月球': 'THE MOON'
};

const INFO_FIELDS = [
  ['直径', 'realDiameter'],
  ['距太阳', 'realDistance'],
  ['公转周期', 'orbitPeriod'],
  ['自转周期', 'rotationPeriod'],
  ['平均温度', 'temperature'],
  ['已知卫星', 'moons'],
  ['主要大气', 'atmosphere']
];

export function PlanetInfo({ celestial, onClose, onCancelTracking }) {
  if (!celestial) return null;

  const thumb = THUMB_MAP[celestial.name]
    ? import.meta.env.BASE_URL + THUMB_MAP[celestial.name]
    : null;
  const accent = celestial.color || celestial.colorHex || '#8296bd';

  return (
    <aside className="planet-info visible" aria-label={`${celestial.name}天体档案`} style={{ '--celestial-accent': accent }}>
      <div className="planet-info-visual">
        {thumb && <img className="planet-info-thumb" src={thumb} alt={`${celestial.name}表面纹理`} />}
        <div className="planet-info-visual-shade" />
        <div className="tracking-badge"><span className="stat-dot" /> TRACKING</div>
        <button className="info-close icon-btn" onClick={onClose} aria-label="关闭天体档案"><Icon name="close" size={17} /></button>
        <div className="planet-info-title">
          <span className="planet-info-en">{ENGLISH_NAMES[celestial.name] || 'CELESTIAL OBJECT'}</span>
          <div className="planet-info-name-row">
            <h2 className="planet-info-name">{celestial.name}</h2>
            {celestial.type && <span className="planet-info-type">{celestial.type}</span>}
          </div>
        </div>
      </div>

      <div className="planet-info-content">
        {celestial.fact && (
          <div className="planet-fact-wrap">
            <span className="panel-eyebrow">DID YOU KNOW?</span>
            <p className="planet-info-fact">{celestial.fact}</p>
          </div>
        )}
        <div className="info-grid">
          {INFO_FIELDS.map(([label, key]) => (
            celestial[key] ? (
              <div className="info-item" key={key}>
                <span className="ii-k">{label}</span>
                <strong className="ii-v">{celestial[key]}</strong>
              </div>
            ) : null
          ))}
        </div>
        <div className="button-container">
          <button className="close-info-btn" onClick={onClose}>继续观测 <Icon name="arrow" size={14} /></button>
          <button className="cancel-tracking-btn" onClick={onCancelTracking} title="停止自动追踪">停止追踪</button>
        </div>
      </div>
      <div className="info-scale-note">天体数据仅供科普参考 · 视觉比例已优化</div>
    </aside>
  );
}
