const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

export function daysSinceJ2000(date = new Date()) {
  return (date.getTime() - J2000_MS) / 86400000;
}

// 牛顿迭代求解开普勒方程 M = E - e·sin(E)。
export function solveKepler(meanAnomaly, eccentricity) {
  const M = ((meanAnomaly % TWO_PI) + TWO_PI) % TWO_PI;
  let E = eccentricity < 0.8 ? M : Math.PI;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const delta = (E - eccentricity * Math.sin(E) - M) / (1 - eccentricity * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-8) break;
  }
  return E;
}

function rotateOrbitalPlane(xOrbit, zOrbit, elements, renderDistance, target) {
  const node = elements.node * DEG;
  const inclination = elements.i * DEG;
  const argument = (elements.perihelion - elements.node) * DEG;
  const cosO = Math.cos(node);
  const sinO = Math.sin(node);
  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);
  const cosW = Math.cos(argument);
  const sinW = Math.sin(argument);
  const x = xOrbit * renderDistance;
  const z = zOrbit * renderDistance;

  target.x = (cosW * cosO - sinW * sinO * cosI) * x + (-sinW * cosO - cosW * sinO * cosI) * z;
  target.y = (sinW * sinI) * x + (cosW * sinI) * z;
  target.z = (cosW * sinO + sinW * cosO * cosI) * x + (-sinW * sinO + cosW * cosO * cosI) * z;
  return target;
}

export function getOrbitalPosition(elements, daysFromJ2000, renderDistance, target = {}) {
  const meanMotion = TWO_PI / elements.period;
  const meanAnomaly = (elements.longitude - elements.perihelion) * DEG + meanMotion * daysFromJ2000;
  const E = solveKepler(meanAnomaly, elements.e);
  return rotateOrbitalPlane(
    Math.cos(E) - elements.e,
    Math.sqrt(1 - elements.e * elements.e) * Math.sin(E),
    elements,
    renderDistance,
    target
  );
}

export function getOrbitPoints(elements, renderDistance, segments = 384) {
  const points = [];
  for (let index = 0; index < segments; index += 1) {
    const E = (index / segments) * TWO_PI;
    const point = rotateOrbitalPlane(
      Math.cos(E) - elements.e,
      Math.sqrt(1 - elements.e * elements.e) * Math.sin(E),
      elements,
      renderDistance,
      {}
    );
    points.push([point.x, point.y, point.z]);
  }
  return points;
}
