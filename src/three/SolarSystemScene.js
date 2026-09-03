import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createSun } from './sun/createSun.js';
import { createPlanets } from './planets/createPlanets.js';
import { createStarfield } from './utils/createStarfield.js';
import { createComposer } from './postprocessing/createComposer.js';
import { createAsteroidBelt, createKuiperBelt } from './objects/createAsteroidBelt.js';
import { createAsteroidTextures } from './objects/asteroidTextures.js';
import { ShipSystem } from './ship/ShipSystem.js';

export class SolarSystemScene {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.sun = null;
    this.solarSystem = null;
    this.starField = null;
    this.planetMeshes = [];
    this.sunLight = null;
    
    this.isPaused = false;
    this.timeSpeed = 1;
    this.showOrbits = true;
    this.showStars = true;
    this.showNames = false;
    this.globalScale = 1.0;
    
    this.currentTargetPlanet = null;
    this.targetDistance = 300;
    this.cameraMoveSpeed = 0.05;
    
    this.animationId = null;
    this.onPlanetClick = null;
    this.onSunClick = null;
    this.onMoonClick = null;
    this.onAsteroidClick = null;
    this.onCharonClick = null;
    
    this.raycaster = null;
    this.mouse = null;

    this.composer = null;
    this.bloomPass = null;
    this.godRaysPass = null;
    this.chromaticPass = null;
    this.colorGradingPass = null;
    this.vignetteGrainPass = null;
    this.composerBroken = false;
    this.bloomEnabled = true;
    this.godRaysEnabled = true;
    this.chromaticEnabled = true;
    this.lensFlareEnabled = true;
    this.lensFlareLevel = 1;
    this.asteroidBelt = null;
    this.kuiperBelt = null;
    this.namedAsteroids = [];
    this.loadingManager = null;
    this.onLoaded = null;
    this.suspended = false;
    this.shipSystem = null;
    this.clock = new THREE.Clock();
  }

  init() {
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      20000
    );
    this.camera.position.set(0, 600, 1800);
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = true;
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 25000;
    
    // 监听鼠标/触摸事件来区分操作类型
    let isZooming = false;
    
    this.renderer.domElement.addEventListener('wheel', () => {
      isZooming = true;
      setTimeout(() => { isZooming = false; }, 100);
    }, { passive: true });
    
    this.controls.addEventListener('start', () => {
      if (this.currentTargetPlanet && !isZooming) {
        this.currentTargetPlanet = null;
      }
    });
    
    this.setupLighting();
    
    this.starField = createStarfield();
    this.scene.add(this.starField);
    
    this.solarSystem = new THREE.Group();
    this.scene.add(this.solarSystem);
    
    // 加载管理器：所有贴图加载完成后通知 UI 关闭加载页
    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.onLoad = () => {
      if (this.onLoaded) this.onLoaded();
    };
    
    this.sun = createSun(this.loadingManager);
    this.sun.castShadow = false;
    this.solarSystem.add(this.sun);
    
    // 银河全景背景（在 LoadingManager 中加载，确保所有贴图就绪后再关闭加载页）
    this.scene.background = this.createSpaceBackground(this.loadingManager);
    this._spaceBackground = this.scene.background;
    
    this.planetMeshes = createPlanets(this.solarSystem, this.loadingManager);
    
    // 火星—木星之间的小行星带
    this.asteroidBelt = createAsteroidBelt(1000, 1400);
    this.solarSystem.add(this.asteroidBelt);

    this.kuiperBelt = createKuiperBelt(6500, 7500);
    this.solarSystem.add(this.kuiperBelt);

    // 知名小行星：谷神星、灶神星、智神星、婚神星
    this.namedAsteroids = this.createNamedAsteroids();

    // 星际飞船系统（由 UI 启用进入飞船模式，不启用时零开销）
    this.shipSystem = new ShipSystem(
      this.scene, this.camera, this.renderer,
      this.solarSystem, this.planetMeshes, this.sun,
      { namedAsteroids: this.namedAsteroids }
    );
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.setupResize();
    this.setupClick();

    // 后期电影级管线（构造失败自动退回普通渲染）
    try {
      const pp = createComposer(this.renderer, this.scene, this.camera);
      this.composer = pp.composer;
      this.bloomPass = pp.bloomPass;
      this.godRaysPass = pp.godRaysPass;
      this.chromaticPass = pp.chromaticPass;
      this.colorGradingPass = pp.colorGradingPass;
      this.vignetteGrainPass = pp.vignetteGrainPass;
      this.lensFlarePass = pp.lensFlarePass;
    } catch (e) {
      console.error('[solar] 后期管线初始化失败，退回普通渲染：', e);
      this.composer = null;
      this.bloomPass = null;
      this.godRaysPass = null;
      this.chromaticPass = null;
      this.colorGradingPass = null;
      this.vignetteGrainPass = null;
      this.lensFlarePass = null;
    }

    this.animate();
  }

  // 深空背景：银河全景贴图（等距柱状投影）+ 增亮与星云色调处理
  createSpaceBackground(manager) {
    if (manager) {
      const tex = new THREE.TextureLoader(manager).load(
        import.meta.env.BASE_URL + 'textures/milkyway.jpg',
        (loaded) => {
          // 加载完成后：canvas 增亮 + 星云氛围叠加，替换为处理后的背景
          const enhanced = this._enhanceSpaceBackground(loaded.image);
          if (enhanced) {
            this.scene.background = enhanced;
            this._spaceBackground = enhanced;
          }
        }
      );
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    }
    // 兜底：细微的蓝紫径向渐变
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 46);
    g.addColorStop(0, '#0b0b1c');
    g.addColorStop(0.55, '#05060f');
    g.addColorStop(1, '#000007');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // 银河增亮 + 程序化星云色调：让深空背景更有层次与氛围
  _enhanceSpaceBackground(image) {
    try {
      const w = 2048, h = 1024;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      // 增亮 + 增饱和，让银河带清晰可见
      ctx.filter = 'brightness(1.55) saturate(1.35) contrast(1.05)';
      ctx.drawImage(image, 0, 0, w, h);
      ctx.filter = 'none';
      // 星云色调叠加：大尺度柔和色块（screen 混合，低透明度）
      ctx.globalCompositeOperation = 'screen';
      const blobs = [
        { x: 0.22, y: 0.42, r: 0.30, col: 'rgba(40, 70, 160, 0.10)' },
        { x: 0.55, y: 0.50, r: 0.36, col: 'rgba(90, 50, 150, 0.09)' },
        { x: 0.80, y: 0.40, r: 0.28, col: 'rgba(30, 100, 140, 0.08)' },
        { x: 0.40, y: 0.55, r: 0.22, col: 'rgba(140, 60, 110, 0.06)' }
      ];
      blobs.forEach(b => {
        const g = ctx.createRadialGradient(b.x * w, b.y * h, 0, b.x * w, b.y * h, b.r * w);
        g.addColorStop(0, b.col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });
      ctx.globalCompositeOperation = 'source-over';
      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    } catch (e) {
      console.warn('[solar] 背景增强失败，使用原始贴图：', e);
      return null;
    }
  }

  setupLighting() {
    // 明亮的环境光：暗面也有清晰可辨的细节，不再黑乎乎一片
    const ambientLight = new THREE.AmbientLight(0x8899bb, 1.15);
    this.scene.add(ambientLight);

    // 半球光：天空冷色、地面暖色，给背阳面充足底光
    const hemiLight = new THREE.HemisphereLight(0x9ab0d8, 0x241c14, 0.85);
    this.scene.add(hemiLight);

    // 太阳点光源：decay=0 无距离衰减，靠低强度控制整体亮度
    this.sunLight = new THREE.PointLight(0xfff2e0, 3.0, 0, 0);
    this.sunLight.position.set(0, 0, 0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 6500;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 1.5;
    this.scene.add(this.sunLight);

    // 补光，勾出球体体积感
    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.6);
    fillLight.position.set(-300, 120, -300);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x99ccff, 0.35);
    rimLight.position.set(0, 200, -400);
    this.scene.add(rimLight);
  }

  setupClick() {
    this.renderer.domElement.addEventListener('click', (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      // 首先检测月球（因为它是子对象，需要优先检测）
      const moonMeshes = [];
      this.planetMeshes.forEach(planet => {
        if (planet.moons && planet.moons.length > 0) {
          planet.moons.forEach(me => moonMeshes.push(me.mesh));
        }
      });
      const moonIntersects = this.raycaster.intersectObjects(moonMeshes);
      if (moonIntersects.length > 0 && this.onMoonClick) {
        const hitMoon = moonIntersects[0].object;
        const planet = this.planetMeshes.find(p =>
          p.moons && p.moons.some(me => me.mesh === hitMoon)
        );
        if (planet) {
          const moonEntry = planet.moons.find(me => me.mesh === hitMoon);
          const moonCfg = moonEntry ? moonEntry.config : {};
          const moonTarget = {
            name: moonCfg.name || '月球',
            mesh: hitMoon,
            radius: hitMoon.geometry.parameters.radius,
            isMoon: true,
            parentPlanet: planet
          };
          this.currentTargetPlanet = moonTarget;
          this.moveCameraToPlanet(moonTarget);
          this.onMoonClick(moonCfg.name || '月球');
        }
        return;
      }
      
      // 然后检测行星（含云层/大气等子网格：递归检测后向上回溯所属行星）
      const planetIntersects = this.raycaster.intersectObjects(
        this.planetMeshes.map(p => p.mesh),
        true
      );

      if (planetIntersects.length > 0) {
        let obj = planetIntersects[0].object;
        let planet = null;
        while (obj) {
          planet = this.planetMeshes.find(p => p.mesh === obj);
          if (planet) break;
          obj = obj.parent;
        }
        if (planet && this.onPlanetClick) {
          this.currentTargetPlanet = planet;
          this.moveCameraToPlanet(planet);
          this.onPlanetClick(planet);
        }
        return;
      }
      
      // 检测知名小行星
      if (this.namedAsteroids && this.namedAsteroids.length > 0) {
        const astMeshes = this.namedAsteroids.map(a => a.mesh);
        const astIntersects = this.raycaster.intersectObjects(astMeshes);
        if (astIntersects.length > 0 && this.onAsteroidClick) {
          const hit = this.namedAsteroids.find(a => a.mesh === astIntersects[0].object);
          if (hit) {
            const target = { name: hit.name, mesh: hit.mesh, radius: hit.radius, isAsteroid: true };
            this.currentTargetPlanet = target;
            this.moveCameraToPlanet(target);
            this.onAsteroidClick(hit);
          }
          return;
        }
      }
      
      // 最后检测太阳
      const sunIntersects = this.raycaster.intersectObject(this.sun);
      if (sunIntersects.length > 0 && this.onSunClick) {
        const sunTarget = {
          name: '太阳',
          mesh: this.sun,
          radius: 120
        };
        this.currentTargetPlanet = sunTarget;
        this.moveCameraToPlanet(sunTarget);
        this.onSunClick();
        return;
      }
    });
  }

  moveCameraToPlanet(planet) {
    const worldPosition = new THREE.Vector3();
    planet.mesh.getWorldPosition(worldPosition);
    
    // 智能特写距离：按星球半径比例，确保视野中星球大小合适
    let closeUpDistance;
    if (planet.isMoon) {
      // 卫星：拉近到半径的5倍
      closeUpDistance = Math.max(planet.radius * 5, 15);
    } else if (planet.isAsteroid) {
      // 小行星：拉近到半径的8倍，但至少10
      closeUpDistance = Math.max(planet.radius * 8, 10);
    } else if (planet.name === '太阳') {
      // 太阳：半径的1.5倍（太大了不能太近）
      closeUpDistance = planet.radius * 1.5;
    } else if (planet.name === '土星') {
      // 土星：考虑环，半径的3倍
      closeUpDistance = planet.radius * 3;
    } else {
      // 其他行星：半径的2.5倍
      closeUpDistance = planet.radius * 2.5;
    }
    
    // 设置相机目标位置（星球前方）
    const targetCameraPos = new THREE.Vector3(
      worldPosition.x + closeUpDistance,
      worldPosition.y + closeUpDistance * 0.3,
      worldPosition.z + closeUpDistance
    );
    
    // 平滑移动相机
    this.animateCameraToPosition(targetCameraPos, worldPosition);
  }
  
  animateCameraToPosition(targetPos, lookAtPos) {
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 1000; // 1秒动画
    const startTime = Date.now();
    
    // 动画过程中暂时禁用控制器更新，避免冲突
    const wasTracking = this.currentTargetPlanet !== null;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数 (ease-out cubic)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // 插值相机位置
      this.camera.position.lerpVectors(startPos, targetPos, easeProgress);
      
      // 插值目标点
      this.controls.target.lerpVectors(startTarget, lookAtPos, easeProgress);
      
      // 更新控制器
      this.controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    // 黑洞体验期间挂起太阳系渲染，让出全部 GPU
    if (this.suspended) return;

    const delta = Math.min(this.clock.getDelta(), 0.05);
    const time = Date.now() * 0.001;
    
    if (!this.isPaused) {
      this.updatePlanets();
      this.updateSun();
    }
    
    if (this.starField && this.starField.children) {
      // 三层星场：各自旋转速度不同，产生视差
      this.starField.children.forEach(layer => {
        if (layer.userData.material) {
          layer.userData.material.uniforms.time.value = time;
        }
        if (layer.userData.rotSpeed) {
          layer.rotation.y += layer.userData.rotSpeed * this.timeSpeed;
        }
      });
    }
    
    if (this.shipSystem && this.shipSystem.enabled) {
      // 飞船模式：飞船系统接管相机与输入
      this.shipSystem.update(delta, this.timeSpeed, this.isPaused);
    } else if (this.currentTargetPlanet) {
      this.updateCameraTracking();
    } else {
      this.controls.update();
    }
    
    // 防止相机进入星球内部（飞船模式时由 ShipSystem 自己的守卫接管，避免拉锯）
    if (!(this.shipSystem && this.shipSystem.enabled)) {
      this.preventCameraInsidePlanets();
    }

    // 更新后期处理 uniforms
    this.updatePostProcessing(time);

    // 渲染：后期管线正常时走电影级渲染，否则普通渲染
    if (this.composerBroken || !this.composer || !this.bloomEnabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    try {
      this.composer.render();
    } catch (e) {
      console.error('[solar] composer.render 失败，退回普通渲染：', e);
      this.composerBroken = true;
      try {
        this.renderer.render(this.scene, this.camera);
      } catch (_) { /* 忽略，下一帧继续 */ }
    }
  }

  updatePlanets() {
    const time = Date.now();
    
    this.planetMeshes.forEach(planet => {
      if (planet.name === '土星') {
        planet.mesh.rotation.y += 0.0008 * this.timeSpeed;
        if (planet.ring && planet.ring.userData.ringMaterial) {
          const saturnWorld = new THREE.Vector3();
          planet.mesh.getWorldPosition(saturnWorld);
          planet.ring.userData.ringMaterial.uniforms.sunDirection.value
            .copy(saturnWorld).multiplyScalar(-1).normalize();
        }
      } else if (planet.name === '火星') {
        planet.mesh.rotation.y += 0.0002 * this.timeSpeed;
      } else if (planet.name === '金星') {
        planet.mesh.rotation.y -= 0.0001 * this.timeSpeed;
      } else {
        planet.mesh.rotation.y += planet.rotationSpeed * this.timeSpeed;
      }
      
      const angle = time * 0.0001 * planet.orbitSpeed * this.timeSpeed;
      const x = Math.cos(angle) * planet.distance;
      const z = Math.sin(angle) * planet.distance;
      planet.mesh.position.set(x, 0, z);
      
      if (planet.moons && planet.moons.length > 0) {
        planet.moons.forEach((moonEntry) => {
          const cfg = moonEntry.config;
          const moonAngle = time * 0.0001 * cfg.orbitSpeed * this.timeSpeed;
          const moonDist = cfg.orbitDistance;
          moonEntry.mesh.position.x = moonDist * Math.cos(moonAngle);
          moonEntry.mesh.position.z = moonDist * Math.sin(moonAngle);
          moonEntry.mesh.rotation.y += cfg.rotationSpeed * this.timeSpeed;
        });
      }

      if (planet.name === '地球') {
        if (planet.clouds) {
          planet.clouds.rotation.y += 0.00012 * this.timeSpeed;
        }
        if (planet.material && planet.material.uniforms && planet.material.uniforms.sunDirection) {
          const earthWorld = new THREE.Vector3();
          planet.mesh.getWorldPosition(earthWorld);
          planet.material.uniforms.sunDirection.value
            .copy(earthWorld).multiplyScalar(-1).normalize();
        }
        if (planet.atmosphere && planet.atmosphere.userData.material) {
          const earthWorld = new THREE.Vector3();
          planet.mesh.getWorldPosition(earthWorld);
          planet.atmosphere.userData.material.uniforms.sunDirection.value
            .copy(earthWorld).multiplyScalar(-1).normalize();
        }
      }
    });
    
    // 小行星带整体缓慢公转
    if (this.asteroidBelt) {
      this.asteroidBelt.rotation.y += 0.0003 * this.timeSpeed;
    }
    // 柯伊伯带更慢公转
    if (this.kuiperBelt) {
      this.kuiperBelt.rotation.y += 0.0001 * this.timeSpeed;
    }
    // 知名小行星公转 + 自转
    if (this.namedAsteroids) {
      this.namedAsteroids.forEach(a => {
        const angle = time * 0.0001 * a.orbitSpeed * this.timeSpeed;
        a.mesh.position.x = Math.cos(angle) * a.distance;
        a.mesh.position.z = Math.sin(angle) * a.distance;
        a.mesh.rotation.y += 0.005 * this.timeSpeed;
      });
    }
  }

  updateSun() {
    if (this.sun) {
      this.sun.rotation.y += 0.005 * this.timeSpeed;
      
      const pulseFactor = Math.sin(Date.now() * 0.001) * 0.02 + 1;
      this.sun.scale.set(pulseFactor, pulseFactor, pulseFactor);
      
      if (this.sunLight) {
          this.sunLight.intensity = 4.2 + Math.sin(Date.now() * 0.002) * 0.25;
      }
      
      const time = Date.now() * 0.001;
      
      if (this.sun.userData) {
        if (this.sun.userData.surfaceMaterial && this.sun.userData.surfaceMaterial.uniforms) {
          this.sun.userData.surfaceMaterial.uniforms.time.value = time;
        }

        if (this.sun.userData.particles && this.sun.userData.particles.userData.material) {
          this.sun.userData.particles.userData.material.uniforms.time.value = time;
        }

        if (this.sun.userData.coronaMaterial && this.sun.userData.coronaMaterial.uniforms) {
          this.sun.userData.coronaMaterial.uniforms.time.value = time;
        }
      }
    }
  }

  updateCameraTracking() {
    const worldPosition = new THREE.Vector3();
    this.currentTargetPlanet.mesh.getWorldPosition(worldPosition);
    
    const adaptiveSpeed = Math.min(0.08 * Math.max(this.timeSpeed, 1), 0.3);
    
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    
    this.controls.target.lerp(worldPosition, adaptiveSpeed);
    
    const newCameraPosition = new THREE.Vector3().addVectors(worldPosition, offset);
    this.camera.position.lerp(newCameraPosition, adaptiveSpeed);
    
    this.controls.update();
  }

  setPaused(paused) {
    this.isPaused = paused;
  }

  setBloom(enabled) {
    this.bloomEnabled = enabled;
  }

  setGodRays(enabled) {
    this.godRaysEnabled = enabled;
    if (this.godRaysPass) {
      this.godRaysPass.uniforms.intensity.value = enabled ? 0.55 : 0.0;
    }
  }

  setChromatic(enabled) {
    this.chromaticEnabled = enabled;
    if (this.chromaticPass) {
      this.chromaticPass.uniforms.amount.value = enabled ? 0.003 : 0.0;
    }
  }

  setLensFlare(enabled) {
    this.lensFlareEnabled = enabled;
  }

  // 每帧更新后期处理 uniforms（太阳屏幕坐标、时间等）
  updatePostProcessing(time) {
    if (!this.composer || this.composerBroken) return;

    // God Rays: 投影太阳到屏幕空间，传递 UV 坐标
    if (this.godRaysPass && this.sun) {
      const sunNDC = this.sun.position.clone().project(this.camera);
      // 太阳在相机背后时 z > 1，禁用光柱
      const behind = sunNDC.z > 1;
      this.godRaysPass.uniforms.sunPosition.value.set(
        (sunNDC.x + 1) * 0.5,
        (sunNDC.y + 1) * 0.5
      );
      if (this.godRaysEnabled && !behind) {
        this.godRaysPass.uniforms.intensity.value = 0.55;
      } else {
        this.godRaysPass.uniforms.intensity.value = 0.0;
      }
    }

    // Vignette + Grain: 更新时间（驱动动态颗粒）
    if (this.vignetteGrainPass) {
      this.vignetteGrainPass.uniforms.time.value = time;
    }

    // Lens Flare: 投影太阳到屏幕空间
    if (this.lensFlarePass && this.sun) {
      const sunNDC = this.sun.position.clone().project(this.camera);
      const behind = sunNDC.z > 1;
      this.lensFlarePass.uniforms.sunScreenPos.value.set(
        (sunNDC.x + 1) * 0.5,
        (sunNDC.y + 1) * 0.5
      );
      this.lensFlarePass.uniforms.sunVisible.value = (this.lensFlareEnabled && !behind) ? 1.0 : 0.0;
      this.lensFlarePass.uniforms.time.value = time * 0.001;
    }
  }

  // 挂起/恢复渲染循环（黑洞体验期间使用）
  setSuspended(suspended) {
    this.suspended = !!suspended;
  }

  // 供导航面板调用：按名称跳转并聚焦某天体
  focusByName(name) {
    if (name === '太阳') {
      const t = { name: '太阳', mesh: this.sun, radius: 120 };
      this.currentTargetPlanet = t;
      this.moveCameraToPlanet(t);
      if (this.onSunClick) this.onSunClick();
      return;
    }
    // Check all moons (multi-moon system)
    for (const planet of this.planetMeshes) {
      if (planet.moons && planet.moons.length > 0) {
        for (const me of planet.moons) {
          if (me.config.name === name) {
            const t = {
              name,
              mesh: me.mesh,
              radius: me.mesh.geometry.parameters.radius,
              isMoon: true,
              parentPlanet: planet
            };
            this.currentTargetPlanet = t;
            this.moveCameraToPlanet(t);
            if (this.onMoonClick) this.onMoonClick(name);
            return;
          }
        }
      }
    }
    // Check named asteroids
    if (this.namedAsteroids) {
      const ast = this.namedAsteroids.find(a => a.name === name);
      if (ast) {
        const t = { name: ast.name, mesh: ast.mesh, radius: ast.radius, isAsteroid: true };
        this.currentTargetPlanet = t;
        this.moveCameraToPlanet(t);
        if (this.onAsteroidClick) this.onAsteroidClick(ast);
        return;
      }
    }
    const target = this.planetMeshes.find(p => p.name === name);
    if (target) {
      this.currentTargetPlanet = target;
      this.moveCameraToPlanet(target);
      if (this.onPlanetClick) this.onPlanetClick(target);
    }
  }

  setTimeSpeed(speed) {
    this.timeSpeed = speed;
  }

  // 单位方向（避免零向量 normalize 产生 NaN 导致整屏黑）
  safeDir(from, to) {
    const d = new THREE.Vector3().subVectors(from, to);
    if (d.lengthSq() < 1e-6) d.set(0, 1, 0);
    return d.normalize();
  }

  preventCameraInsidePlanets() {
    const cameraPos = this.camera.position.clone();

    // 检查太阳
    const sunDistance = cameraPos.distanceTo(this.sun.position);
      const sunMinDistance = 310; // 太阳半径300 + 缓冲10
    if (sunDistance < sunMinDistance) {
      const direction = this.safeDir(cameraPos, this.sun.position);
      this.camera.position.copy(this.sun.position.clone().add(direction.multiplyScalar(sunMinDistance)));
    }

    // 检查所有行星
    this.planetMeshes.forEach(planet => {
      const worldPosition = new THREE.Vector3();
      planet.mesh.getWorldPosition(worldPosition);
      const distance = cameraPos.distanceTo(worldPosition);
      const minDistance = planet.radius * 1.2; // 行星半径 + 20%缓冲

      if (distance < minDistance) {
        const direction = this.safeDir(cameraPos, worldPosition);
        this.camera.position.copy(worldPosition.clone().add(direction.multiplyScalar(minDistance)));
      }

      // 检查月球
      if (planet.moon) {
        const moonWorldPosition = new THREE.Vector3();
        planet.moon.getWorldPosition(moonWorldPosition);
        const moonDistance = cameraPos.distanceTo(moonWorldPosition);
        const moonMinDistance = planet.radius * 0.27 * 1.2; // 月球半径 + 缓冲

        if (moonDistance < moonMinDistance) {
          const direction = this.safeDir(cameraPos, moonWorldPosition);
          this.camera.position.copy(moonWorldPosition.clone().add(direction.multiplyScalar(moonMinDistance)));
        }
      }
    });
  }

  // 镜头光晕：一组加色混合精灵，挂在相机下，按太阳的屏幕投影位置排布
  createLensFlare() {
    const group = new THREE.Group();
    const dist = 200; // 位于相机前方固定距离，纯屏幕空间叠加

    const glow = this.makeFlareSprite(150, 'rgba(255,240,205,0.55)');
    group.add(glow);

    const ghostDefs = [
      { t: -0.18, size: 70, mul: 0.45, color: 'rgba(255,170,110,0.5)' },
      { t: 0.30, size: 46, mul: 0.35, color: 'rgba(170,200,255,0.4)' },
      { t: 0.58, size: 28, mul: 0.30, color: 'rgba(255,220,160,0.35)' },
      { t: 1.00, size: 130, mul: 0.22, color: 'rgba(120,160,255,0.25)' },
      { t: 1.42, size: 56, mul: 0.18, color: 'rgba(255,150,120,0.2)' }
    ];
    const ghosts = ghostDefs.map(d => {
      const s = this.makeFlareSprite(d.size, d.color);
      group.add(s);
      return { sprite: s, t: d.t, mul: d.mul };
    });

    this.camera.add(group);
    this.lensFlare = group;
    this.lensFlareGlow = glow;
    this.lensFlareGhosts = ghosts;
    this.lensFlareDist = dist;
  }

  makeFlareSprite(size, color) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, color);
    g.addColorStop(0.5, color.replace(/[\d.]+\)$/g, '0.25)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      opacity: 0
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(size, size, 1);
    sp.renderOrder = 999;
    return sp;
  }

  updateLensFlare() {
    if (!this.lensFlare) return;
    const ndc = new THREE.Vector3(0, 0, 0).project(this.camera);
    const behind = ndc.z > 1;
    const onScreen = !behind && Math.abs(ndc.x) < 1.3 && Math.abs(ndc.y) < 1.3;

    const aspect = this.camera.aspect;
    const h = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dist = this.lensFlareDist;

    const intensity = onScreen ? (0.2 + 0.8 * Math.max(0, 1 - Math.hypot(ndc.x, ndc.y) * 0.9)) : 0;

    const gx = ndc.x * aspect * h * dist;
    const gy = ndc.y * h * dist;
    this.lensFlareGlow.position.set(gx, gy, -dist);
    this.lensFlareGlow.material.opacity = intensity * 0.9;

    this.lensFlareGhosts.forEach(gh => {
      const px = ndc.x + (0 - ndc.x) * gh.t;
      const py = ndc.y + (0 - ndc.y) * gh.t;
      gh.sprite.position.set(px * aspect * h * dist, py * h * dist, -dist);
      gh.sprite.material.opacity = onScreen ? intensity * gh.mul : 0;
    });
  }

  setShowOrbits(show) {
    this.showOrbits = show;
    this.planetMeshes.forEach(planet => {
      if (planet.orbit) {
        planet.orbit.visible = show;
      }
    });
  }

  setShowStars(show) {
    this.showStars = show;
    if (this.starField) {
      this.starField.visible = show;
    }
    // 银河背景贴图跟随星空开关
    if (this.scene) {
      this.scene.background = show ? this._spaceBackground : null;
    }
  }

  setShowNames(show) {
    this.showNames = show;
  }

  setGlobalScale(scale) {
    this.globalScale = scale;
    if (this.solarSystem) {
      this.solarSystem.scale.set(scale, scale, scale);
    }
  }

  resetView() {
    this.camera.position.set(0, 600, 1800);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.currentTargetPlanet = null;
  }

  cancelTracking() {
    this.currentTargetPlanet = null;
  }

  getPlanetScreenPositions() {
    const positions = {};
    
    this.planetMeshes.forEach(planet => {
      const vector = new THREE.Vector3();
      vector.setFromMatrixPosition(planet.mesh.matrixWorld);
      vector.project(this.camera);
      
      const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
      
      positions[planet.name] = { x, y, visible: this.showNames };
    });
    
    if (this.sun) {
      const vector = new THREE.Vector3();
      vector.setFromMatrixPosition(this.sun.matrixWorld);
      vector.project(this.camera);
      
      const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
      
      positions['太阳'] = { x, y, visible: this.showNames };
    }

    // 知名小行星标签
    if (this.namedAsteroids) {
      this.namedAsteroids.forEach(a => {
        const vector = new THREE.Vector3();
        vector.setFromMatrixPosition(a.mesh.matrixWorld);
        vector.project(this.camera);
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
        positions[a.name] = { x, y, visible: this.showNames };
      });
    }
    
    return positions;
  }

  // 知名小行星：真实比例 + 程序化岩石纹理 + 法线贴图
  createNamedAsteroids() {
    // 真实直径(km) → 半径(地球=10基准): diameter / 12756 * 10
    const data = [
      { name: '谷神星', distance: 1150, radius: 0.74, orbitSpeed: 0.07, seed: 1, fact: '小行星带最大天体，矮行星，直径940公里，表面有盐类沉积。' },
      { name: '灶神星', distance: 1050, radius: 0.41, orbitSpeed: 0.09, seed: 2, fact: '小行星带第二大战体，直径525公里，南极有巨大撞击坑。' },
      { name: '智神星', distance: 1250, radius: 0.40, orbitSpeed: 0.06, seed: 3, fact: '小行星带第三大战体，直径512公里，轨道倾角高达34°。' },
      { name: '婚神星', distance: 1350, radius: 0.20, orbitSpeed: 0.055, seed: 4, fact: '小行星带第四大战体，直径250公里，以罗马婚姻女神命名。' }
    ];

    const asteroids = [];
    data.forEach(d => {
      // 高细分 + 不规则变形：小天体引力不足以形成球体
      const geo = new THREE.IcosahedronGeometry(d.radius, 4);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const nx = pos.getX(i), ny = pos.getY(i), nz = pos.getZ(i);
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len < 0.001) continue;
        // 多层噪声变形
        const noise1 = 0.85 + Math.sin(nx * 5.3 + d.seed) * 0.15;
        const noise2 = 0.9 + Math.cos(ny * 4.7 + d.seed * 2) * 0.1;
        const noise3 = 0.88 + Math.sin(nz * 6.1 + d.seed * 3) * 0.12;
        const deform = noise1 * noise2 * noise3;
        pos.setXYZ(i, nx * deform, ny * deform * (0.75 + Math.sin(d.seed) * 0.15), nz * deform);
      }
      geo.computeVertexNormals();

      // 程序化岩石纹理 + 法线贴图
      const { albedo, normal } = createAsteroidTextures(256, d.seed);

      const mat = new THREE.MeshStandardMaterial({
        map: albedo,
        normalMap: normal,
        normalScale: new THREE.Vector2(1.5, 1.5),
        roughness: 0.92,
        metalness: 0.04,
        flatShading: false
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = d.distance;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.solarSystem.add(mesh);

      asteroids.push({ mesh, name: d.name, distance: d.distance, orbitSpeed: d.orbitSpeed, radius: d.radius, fact: d.fact });
    });
    return asteroids;
  }

  /* ================= 星际飞船模式接口 ================= */

  enableShipMode() {
    if (!this.shipSystem) return false;
    if (this.shipSystem.enabled) return true;
    // 记录接管前的相机状态，退出时完整恢复
    this._preShipCam = {
      pos: this.camera.position.clone(),
      quat: this.camera.quaternion.clone(),
      target: this.controls.target.clone()
    };
    this.controls.enabled = false;
    this.currentTargetPlanet = null;
    this.shipSystem.enable(new THREE.Vector3(0, 140, 980));
    this.shipSystem.attachInput();
    return true;
  }

  disableShipMode() {
    if (!this.shipSystem || !this.shipSystem.enabled) return;
    this.shipSystem.detachInput();
    this.shipSystem.disable();
    this.controls.enabled = true;
    if (this._preShipCam) {
      this.camera.position.copy(this._preShipCam.pos);
      this.camera.quaternion.copy(this._preShipCam.quat);
      this.controls.target.copy(this._preShipCam.target);
      this.controls.update();
      this._preShipCam = null;
    }
  }

  isShipModeEnabled() {
    return !!(this.shipSystem && this.shipSystem.enabled);
  }

  getShipHud() {
    return this.shipSystem ? this.shipSystem.getHudState() : null;
  }

  shipNavTo(name) {
    if (this.shipSystem && this.shipSystem.enabled) {
      return this.shipSystem.setNavTargetByName(name);
    }
    return false;
  }

  shipCancelNav() {
    if (this.shipSystem) this.shipSystem.cancelNav();
  }

  shipSetMode(m) {
    if (this.shipSystem) this.shipSystem.setFlightMode(m);
  }

  shipSetCamera(m) {
    if (this.shipSystem) this.shipSystem.setCameraMode(m);
  }

  shipToggleConsole() {
    if (this.shipSystem) this.shipSystem.toggleConsole();
  }

  shipStick(x, y) {
    if (this.shipSystem) this.shipSystem.setStick(x, y);
  }

  shipStickRoll(v) {
    if (this.shipSystem) this.shipSystem.setStickRoll(v);
  }

  shipThrottle(v) {
    if (this.shipSystem) this.shipSystem.setStickThrottle(v);
  }

  shipOrbit(dTheta, dElev, zoomFactor) {
    if (!this.shipSystem) return;
    if (zoomFactor) this.shipSystem.zoomChase(zoomFactor);
    else this.shipSystem.orbitChase(dTheta || 0, dElev || 0);
  }

  dispose() {
    if (this.shipSystem) {
      this.shipSystem.dispose();
      this.shipSystem = null;
    }
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
    
    this.scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}
