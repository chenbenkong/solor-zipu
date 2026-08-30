import React from 'react';

const THUMB_MAP = {
  '太阳': 'textures/sun.jpg',
  '月球': 'textures/moon.jpg',
  '水星': 'textures/mercury.jpg',
  '金星': 'textures/venus_atmosphere.jpg',
  '地球': 'textures/earth.jpg',
  '火星': 'textures/mars.jpg',
  '木星': 'textures/jupiter.jpg',
  '土星': 'textures/saturn.jpg',
  '天王星': 'textures/uranus.jpg',
  '海王星': 'textures/neptune.jpg',
  '冥王星': 'textures/pluto.jpg'
};

const INFO_FIELDS = [
  ['直径', 'realDiameter'],
  ['距太阳', 'realDistance'],
  ['公转', 'orbitPeriod'],
  ['自转', 'rotationPeriod'],
  ['温度', 'temperature'],
  ['卫星', 'moons'],
  ['大气', 'atmosphere']
];

export function PlanetInfo({ celestial, onClose, onCancelTracking }) {
  if (!celestial) return null;

  const thumb = THUMB_MAP[celestial.name]
    ? import.meta.env.BASE_URL + THUMB_MAP[celestial.name]
    : null;

  return (
    <div className="planet-info visible">
      <div
        className="planet-info-header"
        style={{ background: `linear-gradient(135deg, ${celestial.color || '#444'} 0%, rgba(20,22,40,0.9) 75%)` }}
      >
        {thumb && <img className="planet-info-thumb" src={thumb} alt={celestial.name} />}
        <div className="planet-info-title">
          <span className="planet-info-name">{celestial.name}</span>
          {celestial.type && <span className="planet-info-type">{celestial.type}</span>}
        </div>
      </div>

      {celestial.fact && <p className="planet-info-fact">{celestial.fact}</p>}

      <div className="info-grid">
        {INFO_FIELDS.map(([label, key]) => (
          celestial[key] ? (
            <div className="info-item" key={key}>
              <span className="ii-k">{label}</span>
              <span className="ii-v">{celestial[key]}</span>
            </div>
          ) : null
        ))}
      </div>

      <div className="button-container">
        <button className="close-info-btn" onClick={onClose}>关闭信息</button>
        <button className="cancel-tracking-btn" onClick={onCancelTracking}>取消追踪</button>
      </div>
    </div>
  );
}
