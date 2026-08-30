import * as THREE from 'three';

// 程序化星空：三层不同距离的星场，产生视差深度感
// 近层旋转快、远层旋转慢，相机移动时产生立体深度
export function createStarfield() {
  const group = new THREE.Group();

  const layers = [
    { count: 8000,  radiusMin: 2000, radiusMax: 3500, speed: 0.00008, sizeScale: 1.3 },
    { count: 15000, radiusMin: 4000, radiusMax: 6500, speed: 0.00003, sizeScale: 1.0 },
    { count: 10000, radiusMin: 7000, radiusMax: 10000, speed: 0.00001, sizeScale: 0.7 }
  ];

  layers.forEach(layer => {
    const stars = createStarLayer(layer.count, layer.radiusMin, layer.radiusMax, layer.sizeScale);
    stars.userData.rotSpeed = layer.speed;
    group.add(stars);
  });

  group.userData.rotSpeed = layers[1].speed;
  return group;
}

function createStarLayer(count, radiusMin, radiusMax, sizeScale) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const radius = radiusMin + Math.random() * (radiusMax - radiusMin);

    let theta, phi;
    if (Math.random() < 0.35) {
      theta = Math.random() * Math.PI * 2;
      const band = (Math.random() + Math.random() + Math.random() - 1.5) * 0.35;
      phi = Math.acos(THREE.MathUtils.clamp(band, -1, 1));
    } else {
      theta = Math.random() * Math.PI * 2;
      phi = Math.acos(2 * Math.random() - 1);
    }

    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);

    const starType = Math.random();
    if (starType < 0.12) {
      color.setRGB(1.0, 0.82, 0.55);
    } else if (starType < 0.24) {
      color.setRGB(0.75, 0.85, 1.0);
    } else if (starType < 0.30) {
      color.setRGB(1.0, 0.6, 0.5);
    } else {
      const b = 0.75 + Math.random() * 0.25;
      color.setRGB(b, b, b * 0.98);
    }

    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;

    sizes[i] = (0.6 + Math.random() * 3.0) * sizeScale;
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const starMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float time;

      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 0.75 + 0.25 * sin(time * 1.5 + position.x * 0.01 + position.y * 0.013);
        gl_PointSize = size * twinkle * (320.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float d2 = dist * dist * 4.0;
        float core = exp(-d2 * 9.0);
        float halo = exp(-d2 * 2.2) * 0.28;
        float alpha = clamp(core + halo, 0.0, 1.0);
        vec3 finalColor = vColor * (1.0 + core * 0.8);
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.userData.material = starMaterial;
  return stars;
}
