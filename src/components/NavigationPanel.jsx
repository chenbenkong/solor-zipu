import React, { useState } from 'react';

const STARS = [{ name: '太阳', emoji: '☀️' }];
const PLANETS = [
  { name: '水星', emoji: '☿️' },
  { name: '金星', emoji: '♀️' },
  { name: '地球', emoji: '🌍' },
  { name: '火星', emoji: '♂️' },
  { name: '木星', emoji: '♃' },
  { name: '土星', emoji: '🪐' },
  { name: '天王星', emoji: '⛢' },
  { name: '海王星', emoji: '♆' },
  { name: '冥王星', emoji: '⯓' }
];
const MOONS = [
  { name: '月球', emoji: '🌙' },
  { name: '木卫一（伊奥）', emoji: '🌋' },
  { name: '木卫二（欧罗巴）', emoji: '🧊' },
  { name: '木卫三（盖尼米德）', emoji: '🪨' },
  { name: '木卫四（卡里斯托）', emoji: '🌑' },
  { name: '土卫六（泰坦）', emoji: '🌫️' },
  { name: '土卫二（恩克拉多斯）', emoji: '❄️' }
];
const ASTEROIDS = [
  { name: '谷神星', emoji: '🪨' },
  { name: '灶神星', emoji: '☄️' },
  { name: '智神星', emoji: '💫' },
  { name: '婚神星', emoji: '✨' }
];

const CATEGORIES = [
  { key: 'stars', title: '恒星', items: STARS },
  { key: 'planets', title: '行星', items: PLANETS },
  { key: 'moons', title: '卫星', items: MOONS },
  { key: 'asteroids', title: '小行星', items: ASTEROIDS }
];

export function NavigationPanel({ onSelect }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [collapsed, setCollapsed] = useState({});

  const toggle = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const handle = (name) => {
    setActive(name);
    onSelect(name);
    setOpen(false);
  };

  const renderItem = (item) => (
    <div
      key={item.name}
      className={'nav-item' + (active === item.name ? ' active' : '')}
      data-name={item.name}
      onClick={() => handle(item.name)}
    >
      {item.emoji} {item.name}
    </div>
  );

  return (
    <>
      <button className="navigation-btn" onClick={() => setOpen(o => !o)} title="天体导航">
        ☰ 导航
      </button>

      {open && (
        <div className="navigation-panel">
          <div className="navigation-panel-header">
            <span>选择天体进行追踪</span>
            <button className="close-nav-btn" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="navigation-panel-content">
            {CATEGORIES.map(cat => (
              <div className="nav-category" key={cat.key}>
                <div
                  className="nav-category-title"
                  onClick={() => toggle(cat.key)}
                  style={{ cursor: 'user-select: none' }}
                >
                  <span className="nav-collapse-icon">{collapsed[cat.key] ? '▸' : '▾'}</span>
                  {cat.title}
                </div>
                {!collapsed[cat.key] && (
                  <div className="nav-items">{cat.items.map(renderItem)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
