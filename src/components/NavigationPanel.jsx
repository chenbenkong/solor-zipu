import React, { useMemo, useState } from 'react';
import { Icon } from './Icon';

const BASE = import.meta.env.BASE_URL;

// 天体索引：恒星 / 行星 / 卫星 / 小行星四组，兼顾缩略球与文字检索。
const CATEGORIES = [
  {
    key: 'stars',
    title: '恒星',
    en: 'STARS',
    items: [{ name: '太阳', en: 'Sun', color: '#f6bd60', thumb: 'sun' }]
  },
  {
    key: 'planets',
    title: '行星与矮行星',
    en: 'PLANETS',
    items: [
      { name: '水星', en: 'Mercury', color: '#aaa49c', thumb: 'mercury' },
      { name: '金星', en: 'Venus', color: '#dca55d', thumb: 'venus_atmosphere' },
      { name: '地球', en: 'Earth', color: '#64a8d8', thumb: 'earth' },
      { name: '火星', en: 'Mars', color: '#c86644', thumb: 'mars' },
      { name: '木星', en: 'Jupiter', color: '#d1aa87', thumb: 'jupiter' },
      { name: '土星', en: 'Saturn', color: '#d6bd7d', thumb: 'saturn' },
      { name: '天王星', en: 'Uranus', color: '#9fd8dd', thumb: 'uranus' },
      { name: '海王星', en: 'Neptune', color: '#527fd4', thumb: 'neptune' },
      { name: '冥王星', en: 'Pluto', color: '#b09584', thumb: 'pluto' }
    ]
  },
  {
    key: 'moons',
    title: '卫星',
    en: 'MOONS',
    items: [
      { name: '月球', en: 'Moon', color: '#c9c9c9', thumb: 'moon', parent: '地球' },
      { name: '木卫一（伊奥）', en: 'Io', color: '#d4a030', parent: '木星' },
      { name: '木卫二（欧罗巴）', en: 'Europa', color: '#c8d8e8', parent: '木星' },
      { name: '木卫三（盖尼米德）', en: 'Ganymede', color: '#a09880', parent: '木星' },
      { name: '木卫四（卡里斯托）', en: 'Callisto', color: '#605848', parent: '木星' },
      { name: '土卫六（泰坦）', en: 'Titan', color: '#c89040', parent: '土星' },
      { name: '土卫二（恩克拉多斯）', en: 'Enceladus', color: '#d8e0e8', parent: '土星' }
    ]
  },
  {
    key: 'asteroids',
    title: '小行星',
    en: 'ASTEROIDS',
    items: [
      { name: '谷神星', en: 'Ceres', color: '#8a8578' },
      { name: '灶神星', en: 'Vesta', color: '#8a8578' },
      { name: '智神星', en: 'Pallas', color: '#8a8578' },
      { name: '婚神星', en: 'Juno', color: '#8a8578' }
    ]
  }
];

const TOTAL_BODIES = CATEGORIES.reduce((sum, category) => sum + category.items.length, 0);

export const NavigationPanel = React.memo(function NavigationPanel({ onSelect, selectedName }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState({});

  const categories = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return CATEGORIES;
    return CATEGORIES
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => `${item.name} ${item.en}`.toLowerCase().includes(keyword))
      }))
      .filter((category) => category.items.length);
  }, [query]);

  const searching = query.trim().length > 0;

  const handleSelect = (name) => {
    onSelect(name);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        className={`navigation-btn${open ? ' active' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="打开天体索引"
      >
        <Icon name="navigation" size={16} />
        <span>天体索引</span>
        <span className="nav-count">{TOTAL_BODIES}</span>
      </button>

      {open && (
        <>
          <button className="nav-scrim" onClick={() => setOpen(false)} aria-label="关闭天体索引" />
          <aside className="navigation-panel" aria-label="天体索引">
            <div className="navigation-panel-header">
              <div>
                <span className="eyebrow">CELESTIAL INDEX · {TOTAL_BODIES}</span>
                <h2>天体索引</h2>
              </div>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="关闭天体索引">
                <Icon name="close" size={17} />
              </button>
            </div>

            <label className="nav-search">
              <Icon name="search" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索天体 / Search"
                aria-label="搜索天体"
              />
            </label>

            <div className="navigation-panel-content">
              {categories.map((category) => {
                const isCollapsed = !searching && collapsed[category.key];
                return (
                  <div className="nav-category" key={category.key}>
                    <button
                      className="nav-category-title"
                      onClick={() => setCollapsed((prev) => ({ ...prev, [category.key]: !prev[category.key] }))}
                      aria-expanded={!isCollapsed}
                    >
                      <span>
                        {category.title}
                        <small>{category.en}</small>
                        <em>{category.items.length}</em>
                      </span>
                      <Icon name="chevron" size={14} className={isCollapsed ? 'collapsed' : ''} />
                    </button>

                    {!isCollapsed && (
                      <div className="nav-items">
                        {category.items.map((item) => (
                          <button
                            key={item.name}
                            className={`nav-item${selectedName === item.name ? ' active' : ''}`}
                            onClick={() => handleSelect(item.name)}
                            style={{ '--body-color': item.color }}
                          >
                            <span
                              className={`nav-orb${item.thumb ? ' has-texture' : ' is-procedural'}`}
                              style={item.thumb ? { backgroundImage: `url(${BASE}textures/thumbs/${item.thumb}.webp)` } : undefined}
                              aria-hidden="true"
                            />
                            <span className="nav-item-text">
                              <b>{item.name}</b>
                              <small>{item.parent ? `${item.parent} · ${item.en}` : item.en}</small>
                            </span>
                            {selectedName === item.name && <Icon name="check" size={14} className="nav-check" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {!categories.length && <p className="nav-empty">未找到相关天体</p>}
            </div>

            <div className="nav-footer">
              <span className="status-pulse" /> 选中后天体档案自动展开，镜头持续追踪
            </div>
          </aside>
        </>
      )}
    </>
  );
});
