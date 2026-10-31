import React, { useEffect, useRef } from 'react';
import { Icon } from './Icon';

export function GuideModal({ open, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="guide-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <div className="guide-header">
          <div>
            <span className="panel-eyebrow">FLIGHT MANUAL / 001</span>
            <h2 id="guide-title">欢迎登上观测台</h2>
          </div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="关闭探索指南"><Icon name="close" size={19} /></button>
        </div>
        <p className="guide-lead">行星遵循 J2000 星历与开普勒轨道运行。选择一颗天体，或直接拖动视角，让好奇心决定下一站。</p>
        <div className="guide-grid">
          <article>
            <span className="guide-card-icon"><Icon name="drag" size={22} /></span>
            <div><strong>自由观察</strong><p>拖拽旋转视角，滚轮或双指缩放。点击任意天体即可平滑接近并持续追踪。</p></div>
          </article>
          <article>
            <span className="guide-card-icon"><Icon name="orbit" size={23} /></span>
            <div><strong>控制时间</strong><p>空格键播放或暂停，方向键调整速度；设置中可一键返回今日，并实时查看模拟日期。</p></div>
          </article>
          <article>
            <span className="guide-card-icon"><Icon name="rocket" size={22} /></span>
            <div><strong>深入宇宙</strong><p>在「设置 → 特别任务」中驾驶星隼号，或进入 GARGANTUA 黑洞体验。</p></div>
          </article>
          <article>
            <span className="guide-card-icon"><Icon name="fullscreen" size={21} /></span>
            <div><strong>沉浸观影</strong><p>使用右上角全屏，或点击右下角的观影按钮隐藏界面。按 Esc 随时返回。</p></div>
          </article>
        </div>
        <div className="guide-note"><Icon name="info" size={16} /><span>为便于观察，天体尺寸与轨道距离经过视觉缩放，并非真实比例。</span></div>
        <button className="primary-btn guide-start" onClick={onClose}>开始我的星际旅程 <Icon name="arrow" size={17} /></button>
      </section>
    </div>
  );
}
