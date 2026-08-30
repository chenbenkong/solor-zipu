import React from 'react';

export function StatusDisplay({ zoomLevel, speedLevel }) {
  return (
    <>
      <div className="zoom-level">
        缩放: {typeof zoomLevel === 'number' ? zoomLevel.toFixed(2) : '1.00'}x
      </div>
      <div className="speed-level">
        速度: {typeof speedLevel === 'number' ? speedLevel.toFixed(1) : '1.0'}x
      </div>
    </>
  );
}
