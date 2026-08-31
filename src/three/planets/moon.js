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
    emissive = 0x222222,
    emissiveIntensity = 0.12
  } = config;

  const moonRadius = planetRadius * radiusRatio;
  const orbitDistance = planetRadius * distanceRatio;

  const moonGeometry = new THREE.SphereGeometry(moonRadius, 64, 32);

  // Determine texture source: procedural or file-based
  const texGenerator = MOON_TEXTURE_GENERATORS[name];
  let moonMaterial;

  if (texGenerator) {
    // Procedural texture: generate synchronously on canvas
    const proceduralTex = texGenerator(1024);
    proceduralTex.colorSpace = THREE.SRGBColorSpace;
    proceduralTex.anisotropy = 8;

    moonMaterial = new THREE.MeshPhongMaterial({
      map: proceduralTex,
      shininess: 6,
      emissive: new THREE.Color(emissive),
      emissiveIntensity,
      specular: 0x333333
    });

    // Generate procedural normal map from the texture
    const normalTex = buildNormalMapFromTexture(proceduralTex, 1024);
    if (normalTex) {
      moonMaterial.normalMap = normalTex;
      moonMaterial.normalScale = new THREE.Vector2(1.2, 1.2);
    }
  } else {
    // File-based texture (Moon uses moon.jpg)
    const textureLoader = new THREE.TextureLoader(manager);
    const moonTexture = textureLoader.load(BASE + 'textures/moon_hd.jpg');
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    moonTexture.anisotropy = 8;

    moonMaterial = new THREE.MeshPhongMaterial({
      map: moonTexture,
      shininess: 6,
      emissive: new THREE.Color(emissive),
      emissiveIntensity,
      specular: 0x333333
    });

    // Async normal map from moon.jpg
    const img = new Image();
    img.onload = () => {
      const normalTex = buildNormalMap(img, 1024);
      normalTex.colorSpace = THREE.NoColorSpace;
      normalTex.anisotropy = 8;
      moonMaterial.normalMap = normalTex;
      moonMaterial.normalScale = new THREE.Vector2(1.4, 1.4);
      moonMaterial.needsUpdate = true;
    };
    img.src = BASE + 'textures/moon_hd.jpg';
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

  return {
    moon,
    moonOrbit,
    moonConfig: { name, orbitSpeed, rotationSpeed, orbitDistance }
  };
}

// Build normal map from a Three.js CanvasTexture (synchronous)
function buildNormalMapFromTexture(texture, size) {
  if (!texture.image) return null;
  const img = texture.image;
  return buildNormalMap(img, size);
}

// Build normal map from any image (grayscale height → Sobel normal)
function buildNormalMap(img, size) {
  const cw = size;
  const ch = Math.round((img.height / img.width) * size);

  const src = document.createElement('canvas');
  src.width = cw;
  src.height = ch;
  const sctx = src.getContext('2d');
  sctx.drawImage(img, 0, 0, cw, ch);
  const data = sctx.getImageData(0, 0, cw, ch).data;

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  const odata = octx.createImageData(cw, ch);

  const lum = (x, y) => {
    const xi = (x + cw) % cw;
    const yi = (y + ch) % ch;
    const i = (yi * cw + xi) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };

  const strength = 2.2;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const dx = lum(x + 1, y) - lum(x - 1, y);
      const dy = lum(x, y + 1) - lum(x, y - 1);
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 255;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * cw + x) * 4;
      odata.data[i] = (nx * 0.5 + 0.5) * 255;
      odata.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      odata.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      odata.data[i + 3] = 255;
    }
  }
  octx.putImageData(odata, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  return tex;
}
