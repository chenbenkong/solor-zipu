import React from 'react';

const BODIES = [
  { name: '太阳', en: 'Sun', color: '#f6bd60', texture: 'sun.jpg' },
  { name: '水星', en: 'Mercury', color: '#aaa49c', texture: 'mercury.jpg' },
  { name: '金星', en: 'Venus', color: '#dca55d', texture: 'venus_atmosphere.jpg' },
  { name: '地球', en: 'Earth', color: '#64a8d8', texture: 'earth.jpg' },
  { name: '火星', en: 'Mars', color: '#c86644', texture: 'mars.jpg' },
  { name: '木星', en: 'Jupiter', color: '#d1aa87', texture: 'jupiter.jpg' },
  { name: '土星', en: 'Saturn', color: '#d6bd7d', texture: 'saturn.jpg' },
  { name: '天王星', en: 'Uranus', color: '#9fd8dd', texture: 'uranus.jpg' },
  { name: '海王星', en: 'Neptune', color: '#527fd4', texture: 'neptune.jpg' },
  { name: '冥王星', en: 'Pluto', color: '#b09584', texture: 'pluto.jpg' }
];

export const PlanetQuickNav = React.memo(function PlanetQuickNav({ selectedName, onSelect }) {
  return (
    <nav className="quick-nav" aria-label="快速选择天体">
      <div className="quick-nav-heading">
        <span>快速跃迁</span>
        <span className="quick-nav-heading-en">CELESTIAL INDEX</span>
      </div>
      <div className="quick-nav-track">
        {BODIES.map((body) => (
          <button
            key={body.name}
            className={`quick-planet${selectedName === body.name ? ' active' : ''}`}
            style={{ '--planet-color': body.color }}
            onClick={() => onSelect(body.name)}
            aria-pressed={selectedName === body.name}
            aria-label={`观测${body.name} ${body.en}`}
            title={`观测${body.name}`}
          >
            <span
              className={`quick-planet-orb${body.name === '土星' ? ' has-ring' : ''}`}
              style={{ backgroundImage: `url(${import.meta.env.BASE_URL}textures/${body.texture})` }}
              aria-hidden="true"
            />
            <span className="quick-planet-name">{body.name}</span>
          </button>
        ))}
      </div>
    </nav>
  );
});
