import React, { useMemo, useState } from 'react';
import { Icon } from './Icon';

const CATEGORIES = [
  { key: 'stars', title: '恒星', en: 'STARS', items: [{ name: '太阳', en: 'Sun', color: '#f6bd60' }] },
  { key: 'planets', title: '行星与矮行星', en: 'PLANETS', items: [
    { name: '水星', en: 'Mercury', color: '#aaa49c' }, { name: '金星', en: 'Venus', color: '#dca55d' },
    { name: '地球', en: 'Earth', color: '#64a8d8' }, { name: '火星', en: 'Mars', color: '#c86644' },
    { name: '木星', en: 'Jupiter', color: '#d1aa87' }, { name: '土星', en: 'Saturn', color: '#d6bd7d' },
    { name: '天王星', en: 'Uranus', color: '#9fd8dd' }, { name: '海王星', en: 'Neptune', color: '#527fd4' },
    { name: '冥王星', en: 'Pluto', color: '#b09584' }
  ] },
  { key: 'moons', title: '卫星', en: 'MOONS', items: [
    { name: '月球', en: 'Moon', color: '#c9c9c9' }, { name: '木卫一（伊奥）', en: 'Io', color: '#d4a030' },
    { name: '木卫二（欧罗巴）', en: 'Europa', color: '#c8d8e8' }, { name: '木卫三（盖尼米德）', en: 'Ganymede', color: '#a09880' },
    { name: '木卫四（卡里斯托）', en: 'Callisto', color: '#605848' }, { name: '土卫六（泰坦）', en: 'Titan', color: '#c89040' },
    { name: '土卫二（恩克拉多斯）', en: 'Enceladus', color: '#d8e0e8' }
  ] },
  { key: 'asteroids', title: '小行星', en: 'ASTEROIDS', items: [
    { name: '谷神星', en: 'Ceres', color: '#8a8578' }, { name: '灶神星', en: 'Vesta', color: '#8a8578' },
    { name: '智神星', en: 'Pallas', color: '#8a8578' }, { name: '婚神星', en: 'Juno', color: '#8a8578' }
  ] }
];

export const NavigationPanel = React.memo(function NavigationPanel({ onSelect, selectedName }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState({ stars: true, moons: true, asteroids: true });

  const categories = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return CATEGORIES;
    return CATEGORIES.map((category) => ({
      ...category,
      items: category.items.filter((item) => `${item.name} ${item.en}`.toLowerCase().includes(keyword))
    })).filter((category) => category.items.length);
  }, [query]);

  const handleSelect = (name) => {
    onSelect(name);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button className={`navigation-btn${open ? ' active' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Icon name="navigation" size={16} /> <span>天体索引</span><span className="nav-count">21</span>
      </button>

      {open && (
        <>
          <button className="nav-scrim" onClick={() => setOpen(false)} aria-label="关闭天体索引" />
          <aside className="navigation-panel" aria-label="天体索引">
            <div className="navigation-panel-header">
              <div><span className="eyebrow">DESTINATION</span><h2>选择目的地</h2></div>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="关闭"><Icon name="close" size={17} /></button>
            </div>
            <label className="nav-search">
              <Icon name="search" size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索天体 / Search" aria-label="搜索天体" />
            </label>
            <div className="navigation-panel-content">
              {categories.map((category) => (
                <div className="nav-category" key={category.key}>
                  <button className="nav-category-title" onClick={() => setCollapsed((prev) => ({ ...prev, [category.key]: !prev[category.key] }))} aria-expanded={!collapsed[category.key]}>
                    <span>{category.title}<small>{category.en}</small></span>
                    <Icon name="chevron" size={14} className={collapsed[category.key] ? 'collapsed' : ''} />
                  </button>
                  {!collapsed[category.key] && (
                    <div className="nav-items">
                      {category.items.map((item) => (
                        <button key={item.name} className={`nav-item${selectedName === item.name ? ' active' : ''}`} onClick={() => handleSelect(item.name)}>
                          <span className="nav-body-dot" style={{ background: item.color }} />
                          <span>{item.name}</span><small>{item.en}</small>
                          {selectedName === item.name && <Icon name="check" size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {!categories.length && <p className="nav-empty">未找到相关天体</p>}
            </div>
            <div className="nav-footer"><span className="status-pulse" /> 点击目标后相机将自动追踪</div>
          </aside>
        </>
      )}
    </>
  );
});
