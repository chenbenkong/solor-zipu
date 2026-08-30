import * as THREE from 'three';

export function createSunTexture() {
  const canvas = document.createElement('canvas');
  const size = 1024;
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d');

  const baseGradient = ctx.createRadialGradient(
    size/2, size/4, 0,
    size/2, size/4, size/2
  );
  baseGradient.addColorStop(0, '#ffff66');
  baseGradient.addColorStop(0.5, '#ffdd33');
  baseGradient.addColorStop(0.8, '#ffaa00');
  baseGradient.addColorStop(1, '#ff8800');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, size, size / 2);

  addFlamePatterns(ctx, size);
  addSunspots(ctx, size);
  addGranulation(ctx, size);

  return new THREE.CanvasTexture(canvas);
}

function addFlamePatterns(ctx, size) {
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size * 0.5;
    const width = size * 0.08 + Math.random() * size * 0.2;
    const height = size * 0.05 + Math.random() * size * 0.2;

    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, 'rgba(255, 255, 200, 0.8)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 100, 0.7)');
    gradient.addColorStop(0.7, 'rgba(255, 180, 50, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 100, 0, 0.4)');

    ctx.beginPath();
    ctx.moveTo(x, y + height/2);

    for (let j = 0; j < width; j += 15) {
      const wave = Math.sin(j * 0.1 + i) * 8 + (Math.random() * 10 - 5);
      ctx.lineTo(x + j, y + wave);
    }

    for (let j = width; j >= 0; j -= 15) {
      const wave = Math.sin(j * 0.1 + i + 2) * 6 + (Math.random() * 8 - 4) + height;
      ctx.lineTo(x + j, y + wave);
    }

    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

function addSunspots(ctx, size) {
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size * 0.5;
    const radius = size * 0.03 + Math.random() * size * 0.05;

    const spotGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    spotGradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
    spotGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.3)');
    spotGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = spotGradient;
    ctx.fill();

    const penumbraGradient = ctx.createRadialGradient(x, y, radius * 0.8, x, y, radius * 1.8);
    penumbraGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    penumbraGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
    penumbraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = penumbraGradient;
    ctx.fill();
  }

  for (let i = 0; i < 15; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size * 0.5;
    const radius = size * 0.01 + Math.random() * size * 0.02;

    const spotGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    spotGradient.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    spotGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = spotGradient;
    ctx.fill();
  }
}

function addGranulation(ctx, size) {
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size * 0.5;
    const radius = size * 0.003 + Math.random() * size * 0.01;

    const brightness = 1.2 + (Math.random() * 0.6 - 0.2);
    ctx.fillStyle = `rgba(255, ${200 * brightness}, ${80 * brightness}, ${0.4 + Math.random() * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createSunBumpMap() {
  const canvas = document.createElement('canvas');
  const size = 512;
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, size, size / 2);

  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size / 2;
    const r = 0.5 + Math.random() * 3;

    const value = 60 + Math.random() * 70;
    ctx.fillStyle = `rgb(${value}, ${value}, ${value})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 5; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size / 2;
    const radius = size * 0.03 + Math.random() * size * 0.05;

    const spotGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    spotGradient.addColorStop(0, '#333');
    spotGradient.addColorStop(0.7, '#555');
    spotGradient.addColorStop(1, '#888');

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = spotGradient;
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}
