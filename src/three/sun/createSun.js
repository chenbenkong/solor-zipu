import * as THREE from 'three';
import { createSunSurfaceShader } from './sunShaders.js';

export function createSun(manager) {
  const sunRadius = 300;

  const sunGeometry = new THREE.SphereGeometry(sunRadius, 128, 128);

  // 真实太阳贴图（CC BY 4.0 Solar System Scope）
  const textureLoader = new THREE.TextureLoader(manager);
  const sunTexture = textureLoader.load(import.meta.env.BASE_URL + 'textures/sun.jpg');
  sunTexture.colorSpace = THREE.SRGBColorSpace;
  sunTexture.anisotropy = 8;

  const sunMaterial = createSunSurfaceShader(sunTexture);
  // HDR 亮度：表面超过 1.0，交由 Bloom 自然泛光，无需硬边壳层
  sunMaterial.uniforms.brightness.value = 1.35;

  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.set(0, 0, 0);
  sun.rotation.z = 0.126;
  sun.userData.surfaceMaterial = sunMaterial;

  // 内层暖色光晕：紧凑柔和，仅贴近球缘的一圈氛围光（配合 Bloom）
  const halo = createSunHalo(sunRadius);
  sun.add(halo);

  // 日珥/耀斑粒子：从表面喷流并淡出，营造动态活力
  const particles = createProminenceParticles(sunRadius);
  sun.add(particles);
  sun.userData.particles = particles;

  sun.userData.radius = sunRadius;

  return sun;
}

// 太阳暖色光晕：指数式衰减的径向渐变精灵（核心亮、外围极快速淡出）
function createSunHalo(sunRadius) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = (x - 128) / 128;
      const dy = (y - 128) / 128;
      const d = Math.sqrt(dx * dx + dy * dy);
      // 更快的衰减：光晕紧贴球缘，不外溢成环
      const a = Math.exp(-d * 6.5) * (1 - Math.min(1, d));
      const i = (y * 256 + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 190;
      img.data[i + 2] = 120;
      img.data[i + 3] = Math.max(0, Math.min(255, a * 255 * 0.4));
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(sunRadius * 2.2);
  return sprite;
}

// 日珥粒子：沿球面分布的发射点，向外膨胀并循环
function createProminenceParticles(sunRadius) {
  const count = 600;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3); // x: 角度theta, y: 角度phi, z: 相位
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const phase = Math.random() * Math.PI * 2;
    seeds[i * 3] = theta;
    seeds[i * 3 + 1] = phi;
    seeds[i * 3 + 2] = phase;

    const r = sunRadius * (1.01 + Math.random() * 0.05);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    colors[i * 3] = 1.0;
    colors[i * 3 + 1] = 0.6 + Math.random() * 0.3;
    colors[i * 3 + 2] = 0.2 + Math.random() * 0.2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, radius: { value: sunRadius } },
    vertexShader: /* glsl */`
      attribute vec3 aSeed;
      uniform float time;
      uniform float radius;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        float life = fract(time * 0.15 + aSeed.z / 6.2831);
        // 向外喷射：距离随生命周期增大，接近末尾淡出
        float dist = radius * (1.02 + life * 0.55);
        vec3 dir = vec3(
          sin(aSeed.y) * cos(aSeed.x),
          sin(aSeed.y) * sin(aSeed.x),
          cos(aSeed.y)
        );
        vec3 pos = dir * dist;
        vAlpha = sin(life * 3.1415) * 0.8;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = (18.0 / -mv.z) * (1.0 + life);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float a = (1.0 - d * 2.0) * vAlpha;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true
  });

  const points = new THREE.Points(geometry, material);
  points.userData.material = material;
  return points;
}
