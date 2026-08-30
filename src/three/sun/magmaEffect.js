import * as THREE from 'three';

export function createMagmaEffect() {
  const magmaGroup = new THREE.Group();
  
  const magmaGeometry = new THREE.SphereGeometry(50.5, 64, 32);
  
  const magmaMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  
  const magmaSurface = new THREE.Mesh(magmaGeometry, magmaMaterial);
  
  const magmaSpots = [];
  const spotCount = 8;
  
  for (let i = 0; i < spotCount; i++) {
    const spotGeometry = new THREE.SphereGeometry(3 + Math.random() * 5, 16, 8);
    const spotMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    const spot = new THREE.Mesh(spotGeometry, spotMaterial);
    
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    spot.position.x = 50.2 * Math.sin(phi) * Math.cos(theta);
    spot.position.y = 50.2 * Math.sin(phi) * Math.sin(theta);
    spot.position.z = 50.2 * Math.cos(phi);
    
    spot.lookAt(spot.position.x * 2, spot.position.y * 2, spot.position.z * 2);
    
    spot.userData = {
      originalScale: spot.scale.clone(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.5,
      intensity: 0.7 + Math.random() * 0.3
    };
    
    magmaSpots.push(spot);
    magmaGroup.add(spot);
  }
  
  const flowGeometry = new THREE.SphereGeometry(50.3, 32, 16);
  const flowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    wireframe: false
  });
  
  const flowMesh = new THREE.Mesh(flowGeometry, flowMaterial);
  magmaGroup.add(flowMesh);
  
  magmaGroup.userData = {
    spots: magmaSpots,
    surface: magmaSurface,
    flow: flowMesh,
    baseMaterial: magmaMaterial
  };
  
  return magmaGroup;
}
