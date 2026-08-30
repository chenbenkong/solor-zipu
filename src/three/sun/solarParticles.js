import * as THREE from 'three';

export function createSolarParticleSystem() {
  const particlesGroup = new THREE.Group();

  const particlesGeometry = new THREE.BufferGeometry();
  const particleCount = 200;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const radius = 50 * (1.02 + Math.random() * 0.1);

    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);

    const colorFactor = 0.7 + Math.random() * 0.3;
    colors[i3] = 1.0;
    colors[i3 + 1] = colorFactor;
    colors[i3 + 2] = 0.5 * colorFactor;

    sizes[i] = 0.5 + Math.random() * 1.0;
  }

  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particlesGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const particlesMaterial = new THREE.PointsMaterial({
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    size: 2
  });

  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  particlesGroup.add(particles);

  const coronaGeometry = new THREE.SphereGeometry(50 * 1.15, 32, 16);
  const coronaMaterial = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  });
  const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
  particlesGroup.add(corona);

  const outerCoronaGeometry = new THREE.SphereGeometry(50 * 1.3, 32, 16);
  const outerCoronaMaterial = new THREE.MeshBasicMaterial({
    color: 0xff9933,
    transparent: true,
    opacity: 0.05,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  });
  const outerCorona = new THREE.Mesh(outerCoronaGeometry, outerCoronaMaterial);
  particlesGroup.add(outerCorona);

  particlesGroup.userData = {
    particlePositions: positions,
    particleCount: particleCount,
    particles: particles,
    corona: corona,
    outerCorona: outerCorona,
    coronaOriginalOpacity: 0.15,
    outerCoronaOriginalOpacity: 0.05
  };

  return particlesGroup;
}
