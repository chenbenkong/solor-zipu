import * as THREE from 'three';
import { planetData } from '../../data/planetData.js';
import { ORBITAL_ELEMENTS } from '../../data/orbitalElements.js';
import { getOrbitPoints } from '../orbitalMechanics.js';
import { createMoon } from './moon.js';

const BASE = import.meta.env.BASE_URL;
const IS_COMPACT = window.matchMedia?.('(max-width: 768px)').matches;

export function createPlanets(solarSystem, manager) {
  const planetMeshes = [];

  planetData.forEach(planet => {
    const orbitalElements = ORBITAL_ELEMENTS[planet.name];
    const renderDistance = orbitalElements?.renderDistance ?? planet.distance;
    const segments = IS_COMPACT ? 40 : 64;
    const geometry = new THREE.SphereGeometry(planet.radius, segments, segments);

    let material;

    if (planet.name === '木星') {
      material = createGasGiantMaterial(manager, 'textures/jupiter.webp', 0x3a2a1a, 0.10);
    } else if (planet.name === '土星') {
      material = createGasGiantMaterial(manager, 'textures/saturn.webp', 0x4a3a20, 0.10);
    } else if (planet.name === '地球') {
      material = createEarthMaterial(manager);
    } else if (planet.name === '火星') {
      material = createSimplePlanetMaterial(manager, 'textures/mars.webp', 0x301005, 0.05, true);
    } else if (planet.name === '金星') {
      material = createSimplePlanetMaterial(manager, 'textures/venus_atmosphere.webp', 0x2a1a08, 0.12, true);
    } else if (planet.name === '水星') {
      material = createSimplePlanetMaterial(manager, 'textures/mercury.webp', 0x222018, 0.06, true);
    } else if (planet.name === '天王星') {
      material = createSimplePlanetMaterial(manager, 'textures/uranus.webp', 0x0a2a3a, 0.08, true);
    } else if (planet.name === '海王星') {
      material = createSimplePlanetMaterial(manager, 'textures/neptune.webp', 0x081830, 0.08, true);
    } else if (planet.name === '冥王星') {
      material = createSimplePlanetMaterial(manager, 'textures/pluto.webp', 0x1a120a, 0.06, true);
    } else {
      material = new THREE.MeshPhongMaterial({
        color: planet.color,
        shininess: 30,
        specular: 0x222222
      });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = renderDistance;
    mesh.rotation.x = THREE.MathUtils.degToRad(planet.tilt);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    solarSystem.add(mesh);

    const orbit = createOrbitLine(planet, orbitalElements, renderDistance);
    solarSystem.add(orbit);

    const planetObj = {
      mesh,
      orbit,
      material,
      moonCount: planet.moons,
      ...planet,
      distance: renderDistance,
      orbitalElements,
      rotationHours: orbitalElements?.rotationHours
    };

    // 大气辉光：Fresnel 边缘光
    if (planet.atmoColor) {
      if (planet.name === '地球') {
        const atmo = createEarthAtmosphere(planet.radius);
        mesh.add(atmo);
        planetObj.atmosphere = atmo;
      } else {
        mesh.add(createAtmosphere(planet.radius, planet.atmoColor));
      }
    }

    // Multi-moon system: iterate moonsList (Jupiter/Saturn) or legacy single Moon
    planetObj.moons = [];
    if (planet.moonsList && planet.moonsList.length > 0) {
      planet.moonsList.forEach((moonCfg, idx) => {
        const { moon, moonOrbit, moonConfig } = createMoon(planet.radius, manager, moonCfg);
        moon.castShadow = true;
        moon.receiveShadow = true;
        // Stagger initial moon positions around orbit
        moon.position.x = moonConfig.orbitDistance * Math.cos(idx * Math.PI * 0.5);
        moon.position.z = moonConfig.orbitDistance * Math.sin(idx * Math.PI * 0.5);
        mesh.add(moon);
        mesh.add(moonOrbit);
        planetObj.moons.push({ mesh: moon, moonOrbit, config: moonConfig });
      });
    } else if (planet.hasMoon) {
      const { moon, moonOrbit, moonConfig } = createMoon(planet.radius, manager);
      moon.castShadow = true;
      moon.receiveShadow = true;
      mesh.add(moon);
      mesh.add(moonOrbit);
      planetObj.moons.push({ mesh: moon, moonOrbit, config: moonConfig });
      // Backward compat: keep planetObj.moon for Earth
      planetObj.moon = moon;
    }

    if (planet.name === '地球') {
      const clouds = createClouds(planet.radius, manager);
      mesh.add(clouds);
      planetObj.clouds = clouds;
    }

    if (planet.hasRings) {
      const ring = createRings(planet, manager);
      mesh.add(ring);
      planetObj.ring = ring;
    }

    planetMeshes.push(planetObj);
  });

  return planetMeshes;
}

function loadTex(manager, path) {
  const t = new THREE.TextureLoader(manager).load(BASE + path);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

// Fresnel 边缘大气辉光
function createAtmosphere(radius, color) {
  const geometry = new THREE.SphereGeometry(radius * 1.04, IS_COMPACT ? 24 : 36, IS_COMPACT ? 24 : 36);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      coeff: { value: 0.62 },
      power: { value: 3.4 }
    },
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 glowColor;
      uniform float coeff;
      uniform float power;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(clamp(coeff - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), power);
        gl_FragColor = vec4(glowColor, intensity);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
  return new THREE.Mesh(geometry, material);
}

// 地球大气散射：Rayleigh 散射 + Beer-Lambert 消光 + 晨昏线红化
function createEarthAtmosphere(radius) {
  const geometry = new THREE.SphereGeometry(radius * 1.06, IS_COMPACT ? 28 : 40, IS_COMPACT ? 28 : 40);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      sunDirection: { value: new THREE.Vector3(1, 0, 0) }
    },
    vertexShader: /* glsl */`
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 sunDirection;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewDir);
        vec3 sunDir = normalize(sunDirection);

        // 太阳入射角：正值=白天，负值=夜晚
        float sunDot = dot(normal, sunDir);

        // Rayleigh 散射：短波蓝光散射更强（白天天空蓝色）
        float scatter = max(sunDot, 0.0);
        vec3 rayleigh = vec3(0.15, 0.35, 0.9) * pow(scatter, 0.8);

        // 晨昏线红化：光线穿过更厚大气层，蓝光被散射掉，只剩红/橙
        float terminator = smoothstep(-0.15, 0.25, sunDot);
        vec3 sunset = vec3(1.0, 0.35, 0.08) * pow(1.0 - terminator, 2.5) * 0.7;

        // Beer-Lambert 消光：背阳面光被吸收
        float extinction = exp(-max(-sunDot, 0.0) * 3.0);

        // 菲涅尔边缘增亮：视线穿过更厚大气层
        float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
        float limb = pow(fresnel, 2.5) * 0.5;

        // 合成
        vec3 scatterLight = (rayleigh + sunset) * extinction;
        vec3 limbColor = mix(vec3(0.3, 0.5, 1.0), vec3(1.0, 0.5, 0.2), 1.0 - terminator);
        vec3 finalColor = scatterLight + limbColor * limb;

        float alpha = clamp(scatter * 0.7 + sunset * 0.5 + limb * 0.35, 0.0, 0.85);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.material = material;
  return mesh;
}

// 轨道线使用与天体位置完全一致的轨道根数，呈现真实椭圆、倾角与升交点方向。
function createOrbitLine(planet, elements, renderDistance) {
  const fallback = { a: 1, e: 0, i: 0, node: 0, perihelion: 0 };
  const points = getOrbitPoints(elements || fallback, renderDistance, IS_COMPACT ? 256 : 384);
  const positions = new Float32Array(points.length * 3);
  points.forEach((point, index) => positions.set(point, index * 3));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(planet.colorHex || '#7794b8'),
    transparent: true,
    opacity: planet.name === '冥王星' ? 0.2 : 0.26,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const orbit = new THREE.LineLoop(geometry, material);
  orbit.renderOrder = -1;
  return orbit;
}

// 地球：昼夜着色器 + 地形法线
function createEarthMaterial(manager) {
  const dayMap = loadTex(manager, 'textures/earth.webp');
  const nightMap = loadTex(manager, 'textures/earth_night.webp');
  const specMap = new THREE.TextureLoader(manager).load(BASE + 'textures/earth_specular.webp');
  specMap.colorSpace = THREE.NoColorSpace;
  specMap.anisotropy = 16;
  const normalMap = new THREE.TextureLoader(manager).load(BASE + 'textures/earth_normal.webp');
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.anisotropy = 16;

  return new THREE.ShaderMaterial({
    extensions: { derivatives: true },
    uniforms: {
      dayMap: { value: dayMap },
      nightMap: { value: nightMap },
      specMap: { value: specMap },
      normalMap: { value: normalMap },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vWorldNormal = mat3(modelMatrix) * normal;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform sampler2D specMap;
      uniform sampler2D normalMap;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      vec3 perturbNormal(vec3 N, vec3 worldPos, vec2 uv, vec3 mapN) {
        vec3 dp1 = dFdx(worldPos);
        vec3 dp2 = dFdy(worldPos);
        vec2 duv1 = dFdx(uv);
        vec2 duv2 = dFdy(uv);
        vec3 dp2perp = cross(dp2, N);
        vec3 dp1perp = cross(N, dp1);
        vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
        vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
        float invmax = inversesqrt(max(dot(T, T), dot(B, B)));
        mat3 TBN = mat3(T * invmax, B * invmax, N);
        return normalize(TBN * mapN);
      }

      void main() {
        vec3 geometricN = normalize(vWorldNormal);
        vec3 mapN = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
        vec3 N = perturbNormal(geometricN, vWorldPos, vUv, mapN);

        vec3 L = normalize(sunDirection);
        float NdotL = dot(N, L);
        float dayAmount = smoothstep(-0.08, 0.22, NdotL);

        vec3 day = texture2D(dayMap, vUv).rgb;
        vec3 night = texture2D(nightMap, vUv).rgb;
        night = pow(night, vec3(0.9)) * 2.2;

        float terminator = smoothstep(0.0, 0.25, NdotL) * (1.0 - smoothstep(0.25, 0.5, NdotL));
        vec3 twilight = vec3(0.9, 0.45, 0.15) * terminator * 0.5;

        vec3 color = mix(night, day, dayAmount) + twilight;
        // 夜面微光：淡淡的蓝色地球反照，避免背阳面死黑
        color += day * vec3(0.05, 0.07, 0.12) * (1.0 - dayAmount);

        float ocean = texture2D(specMap, vUv).r;
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 50.0) * ocean * dayAmount;
        color += vec3(0.7, 0.85, 1.0) * spec * 0.7;

        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
}

function createClouds(radius, manager) {
  const cloudTex = loadTex(manager, 'textures/earth_clouds.webp');
  const geo = new THREE.SphereGeometry(radius * 1.012, IS_COMPACT ? 32 : 48, IS_COMPACT ? 32 : 48);
  const mat = new THREE.MeshPhongMaterial({
    map: cloudTex,
    alphaMap: cloudTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
    shininess: 5
  });
  return new THREE.Mesh(geo, mat);
}

function createGasGiantMaterial(manager, path, emissive, intensity) {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.9,
    metalness: 0.0,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: intensity
  });
  const loader = new THREE.TextureLoader(manager);
  loader.load(BASE + path, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    mat.map = tex;
    mat.needsUpdate = true;
  });
  return mat;
}

function createSimplePlanetMaterial(manager, path, emissive, intensity) {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.95,
    metalness: 0.0,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: intensity
  });
  const loader = new THREE.TextureLoader(manager);
  loader.load(BASE + path, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    mat.map = tex;
    mat.needsUpdate = true;
  });
  return mat;
}

function createRings(planet, manager) {
  if (planet.name === '土星') {
    return createSaturnRingSystem(planet.radius);
  }

  const innerRadius = planet.radius * 1.4;
  const outerRadius = planet.radius * 2.2;
  const opacity = planet.ringOpacity || 0.5;

  const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 128);
  remapRingUV(ringGeometry, innerRadius, outerRadius);
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: opacity,
    roughness: 1.0,
    emissive: new THREE.Color(0x223344),
    emissiveIntensity: 0.2
  });

  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  return ring;
}

// 土星环：自定义着色器 — 背光散射 + 行星阴影 + 透明度层次
function createSaturnRingSystem(planetRadius) {
  const radius = planetRadius;
  const inner = radius * 1.20;
  const outer = radius * 3.40;
  const geo = new THREE.RingGeometry(inner, outer, 256);
  remapRingUV(geo, inner, outer);

  const tex = createRingColorTexture();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: tex },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      planetRadius: { value: radius }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D map;
      uniform vec3 sunDirection;
      uniform float planetRadius;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec4 texColor = texture2D(map, vUv);
        float ringAlpha = texColor.a;

        vec3 sunDir = normalize(sunDirection);
        float sunDot = dot(vWorldNormal, sunDir);
        float backscatter = pow(max(-sunDot, 0.0), 3.0) * 0.2;
        float forwardscatter = pow(max(sunDot, 0.0), 2.0) * 0.1;
        float scatter = backscatter + forwardscatter;

        vec3 toRing = vWorldPos;
        float shadow = 1.0;
        float ringDist = length(toRing.xz);
        if (ringDist < planetRadius * 1.5) {
          float projOnSunAxis = dot(toRing, sunDir);
          float perpDist = length(toRing - sunDir * projOnSunAxis);
          if (projOnSunAxis < 0.0 && perpDist < planetRadius) {
            shadow = mix(0.15, 1.0, smoothstep(planetRadius * 0.3, planetRadius, perpDist));
          }
        }

        float edgeFade = smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x);

        vec3 ringColor = texColor.rgb * (0.9 + scatter * 0.5) * shadow;
        float alpha = ringAlpha * edgeFade * (0.7 + scatter * 0.3);

        gl_FragColor = vec4(ringColor, alpha);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false
  });

  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = Math.PI / 2;
  ring.rotation.z = THREE.MathUtils.degToRad(26.7);

  const group = new THREE.Group();
  group.add(ring);
  group.userData.ringMaterial = mat;
  return group;
}

function createRingColorTexture() {
  const w = 2048, h = 16;
  const cvs = document.createElement('canvas');
  cvs.width = w; cvs.height = h;
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(w, h);

  // 半径比例 -> 环带属性（alpha 控制缝隙）
  const bands = [
    { r0: 1.20, r1: 1.46, a: 0.18 }, // C
    { r0: 1.46, r1: 1.98, a: 0.95 }, // B
    { r0: 1.98, r1: 2.04, a: 0.02 }, // 卡西尼缝
    { r0: 2.04, r1: 2.30, a: 0.82 }, // A
    { r0: 2.30, r1: 2.34, a: 0.7 },  // F
    { r0: 2.34, r1: 2.40, a: 0.05 },
    { r0: 2.40, r1: 3.40, a: 0.16 }  // E
  ];

  for (let x = 0; x < w; x++) {
    const rf = 1.20 + (3.40 - 1.20) * (x / w);
    let band = bands[bands.length - 1];
    for (const b of bands) { if (rf >= b.r0 && rf < b.r1) { band = b; break; } }
    // 颜色：B/A 环偏暖棕，C/E 环偏灰
    const t = (rf - 1.20) / (3.40 - 1.20);
    const r = 200 - t * 30 + (Math.random() * 18 - 9);
    const g = 178 - t * 26 + (Math.random() * 16 - 8);
    const b = 150 - t * 24 + (Math.random() * 14 - 7);
    // 环带内细微明暗
    const fine = 0.85 + 0.15 * Math.sin(x * 0.7) + (Math.random() * 0.1 - 0.05);
    const a = Math.max(0, Math.min(1, band.a * fine));
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      img.data[i] = r * fine;
      img.data[i + 1] = g * fine;
      img.data[i + 2] = b * fine;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

// 把 RingGeometry 的 UV 重映射为「径向 = u」，匹配条带贴图
function remapRingUV(geometry, innerR, outerR) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.sqrt(x * x + y * y);
    const u = (r - innerR) / (outerR - innerR);
    uv.setXY(i, u, 0.5);
  }
  uv.needsUpdate = true;
}
