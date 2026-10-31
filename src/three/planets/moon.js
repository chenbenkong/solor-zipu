import * as THREE from 'three';
import { MOON_TEXTURE_GENERATORS } from './moonTextures.js';

const BASE = import.meta.env.BASE_URL;

/**
 * Create a moon mesh + orbit ring.
 * @param {number} planetRadius - parent planet radius
 * @param {object} manager - LoadingManager
 * @param {object} [config] - moon configuration
 * @param {string}  config.name       - moon display name (e.g. '木卫一（伊奥）')
 * @param {number}  [config.radiusRatio=0.27] - moon radius = planetRadius * ratio
 * @param {number}  [config.distanceRatio=2.0] - orbit distance = planetRadius * ratio
 * @param {number}  [config.orbitSpeed=2.0]   - orbital angular speed multiplier
 * @param {number}  [config.rotationSpeed=0.0003] - self-rotation speed
 * @param {number}  [config.emissive=0x222222] - emissive color
 * @param {number}  [config.emissiveIntensity=0.12] - emissive intensity
 */
export function createMoon(planetRadius, manager, config = {}) {
  const {
    name = '月球',
    radiusRatio = 0.27,
    distanceRatio = 2.0,
    orbitSpeed = 2.0,
    rotationSpeed = 0.0003,
    emissive = 0x000000,
    emissiveIntensity = 0.0
  } = config;

  const moonRadius = planetRadius * radiusRatio;
  const orbitDistance = planetRadius * distanceRatio;

  const compact = window.matchMedia?.('(max-width: 768px)').matches;
  const moonGeometry = new THREE.SphereGeometry(moonRadius, compact ? 24 : 36, compact ? 18 : 28);

  // Determine texture source: procedural or file-based
  const texGenerator = MOON_TEXTURE_GENERATORS[name];
  let moonMaterial;

  if (texGenerator) {
    // 卫星在首屏只有几个像素，低分辨率纹理足够；近景时仍由光照与地貌色块保持可辨识度。
    const proceduralTex = texGenerator(compact ? 96 : 128);
    proceduralTex.colorSpace = THREE.SRGBColorSpace;
    proceduralTex.anisotropy = 4;

    moonMaterial = new THREE.MeshPhongMaterial({
      map: proceduralTex,
      shininess: 6,
      emissive: new THREE.Color(emissive),
      emissiveIntensity,
      specular: 0x333333
    });
  } else {
    const textureLoader = new THREE.TextureLoader(manager);
    const moonTexture = textureLoader.load(BASE + 'textures/moon.webp');
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    moonTexture.anisotropy = 4;

    moonMaterial = new THREE.MeshPhongMaterial({
      map: moonTexture,
      shininess: 6,
      emissive: new THREE.Color(emissive),
      emissiveIntensity,
      specular: 0x333333
    });
  }

  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
  moon.position.x = orbitDistance;

  // Orbit ring
  const moonOrbitGeometry = new THREE.RingGeometry(orbitDistance, orbitDistance + 0.3, 64);
  const moonOrbitMaterial = new THREE.MeshBasicMaterial({
    color: 0x444444,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.2
  });
  const moonOrbit = new THREE.Mesh(moonOrbitGeometry, moonOrbitMaterial);
  moonOrbit.rotation.x = Math.PI / 2;

  // 卫星专属柔光：太阳直射过强时保证贴图细节可见（不改变行星光照）
  const moonFill = new THREE.PointLight(0xbfd4ff, 0.85, moonRadius * 30, 2);
  moon.add(moonFill);
  moonFill.position.set(moonRadius * 4, moonRadius * 3, moonRadius * 5);

  return {
    moon,
    moonOrbit,
    moonConfig: { name, orbitSpeed, rotationSpeed, orbitDistance }
  };
}