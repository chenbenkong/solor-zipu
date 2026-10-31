import React from 'react';

const BODIES = [
  { name: '太阳', en: 'Sun', color: '#f6bd60', thumb: 'sun.webp' },
  { name: '水星', en: 'Mercury', color: '#aaa49c', thumb: 'mercury.webp' },
  { name: '金星', en: 'Venus', color: '#dca55d', thumb: 'venus_atmosphere.webp' },
  { name: '地球', en: 'Earth', color: '#64a8d8', thumb: 'earth.webp' },
  { name: '火星', en: 'Mars', color: '#c86644', thumb: 'mars.webp' },
  { name: '木星', en: 'Jupiter', color: '#d1aa87', thumb: 'jupiter.webp' },
  { name: '土星', en: 'Saturn', color: '#d6bd7d', thumb: 'saturn.webp' },
  { name: '天王星', en: 'Uranus', color: '#9fd8dd', thumb: 'uranus.webp' },
  { name: '海王星', en: 'Neptune', color: '#527fd4', thumb: 'neptune.webp' },
  { name: '冥王星', en: 'Pluto', color: '#b09584', thumb: 'pluto.webp' }
];

export const PlanetQuickNav = React.memo(function PlanetQuickNav({ selectedName, onSelect }) {
  return (
    <nav className="quick-nav" aria-label="快速选择天体">
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
              style={{ backgroundImage: `url(${import.meta.env.BASE_URL}textures/thumbs/${body.thumb})` }}
              aria-hidden="true"
            />
            <span className="quick-planet-name">{body.name}</span>
          </button>
        ))}
      </div>
    </nav>
  );
});
