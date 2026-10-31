import React, { useMemo } from 'react';

const LABEL_HEIGHT = 24;

export function PlanetLabels({ positions, selectedName }) {
  const labels = useMemo(() => {
    if (!positions || selectedName) return [];
    const width = window.innerWidth;
    const height = window.innerHeight;
    const occupied = [];
    const bodies = Object.entries(positions)
      .filter(([, pos]) => pos.visible)
      .map(([name, pos]) => {
        const radius = Math.max(10, pos.radius || 0);
        return { name, left: pos.x - radius, right: pos.x + radius, top: pos.y - radius, bottom: pos.y + radius };
      });

    return Object.entries(positions).flatMap(([name, pos]) => {
      if (!pos.visible) return [];
      const labelWidth = Math.max(52, name.length * 14 + 26);
      const x = Math.min(width - labelWidth, Math.max(labelWidth, pos.x));
      const y = pos.y - Math.max(22, (pos.radius || 0) + 14);

      // 避开标题、天体档案、导航与底部控制区，避免文字压在行星或控件上。
      if (y < 92 || y > height - 218) return [];
      if (x - labelWidth / 2 < 460 && y < 420) return [];
      if (x > width - 250 && y < 165) return [];

      const rect = {
        left: x - labelWidth / 2 - 8,
        right: x + labelWidth / 2 + 8,
        top: y - LABEL_HEIGHT / 2 - 6,
        bottom: y + LABEL_HEIGHT / 2 + 6
      };
      const overlapsBody = bodies.some(body => (
        body.name !== name &&
        rect.left < body.right &&
        rect.right > body.left &&
        rect.top < body.bottom &&
        rect.bottom > body.top
      ));
      const overlapsLabel = occupied.some(other => (
        rect.left < other.right &&
        rect.right > other.left &&
        rect.top < other.bottom &&
        rect.bottom > other.top
      ));
      if (overlapsBody || overlapsLabel) return [];
      occupied.push(rect);
      return [{ name, x, y, width: labelWidth }];
    });
  }, [positions, selectedName]);

  return labels.map(label => (
    <div
      key={label.name}
      className="planet-label"
      style={{ left: `${label.x}px`, top: `${label.y}px` }}
    >
      {label.name}
    </div>
  ));
}
