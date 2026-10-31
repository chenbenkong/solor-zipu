import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createSun } from './sun/createSun.js';
import { createPlanets } from './planets/createPlanets.js';
import { createStarfield } from './utils/createStarfield.js';
import { daysSinceJ2000, getOrbitalPosition, J2000_MS } from './orbitalMechanics.js';

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
    this.showNames = true;
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
    this._distantLoader = null;
    this.loadingManager = null;
    this.onLoaded = null;
    this.suspended = false;
    this.shipSystem = null;
    this._shipLoader = null;
    this._postLoader = null;
    this.clock = new THREE.Clock();
    this.simulationDays = daysSinceJ2000();
    this.onTimeUpdate = null;
    this._lastDateEmit = 0;
    this.cameraTransition = null;
    this._worldPosition = new THREE.Vector3();
    this._transitionDrift = new THREE.Vector3();

    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
    const smallViewport = window.matchMedia?.('(max-width: 768px)').matches;
    this.prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.lowPower = Boolean(coarsePointer || smallViewport || this.prefersReducedMotion);
    this.maxPixelRatio = this.lowPower ? 1.35 : 1.75;
    this._frameCounter = 0;
    this._adaptiveRatio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    this._lastFrameAt = 0;
    this._visibilityHandler = () => {
      if (!document.hidden && this.controls) this.controls.update();
    };
  }

  getHomeView() {
    const compact = window.innerWidth < 768;
    return {
      position: compact ? new THREE.Vector3(0, 2100, 4800) : new THREE.Vector3(0, 1450, 3700),
      target: compact ? new THREE.Vector3(0, 0, 450) : new THREE.Vector3(0, 0, 380)
    };
  }

  getSimulationDate() {
    return new Date(J2000_MS + this.simulationDays * 86400000);
  }

  resetSimulationTime() {
    this.simulationDays = daysSinceJ2000();
    this.updatePlanets(0);
    if (this.onTimeUpdate) this.onTimeUpdate(this.getSimulationDate());
  }

  init() {
    performance.mark('solar-scene-init');
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      0.5,
      20000
    );
    const homeView = this.getHomeView();
    this.camera.position.copy(homeView.position);
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.lowPower,
      alpha: true,
      powerPreference: this.lowPower ? 'default' : 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(this._adaptiveRatio);
    this.renderer.shadowMap.enabled = false;
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
    this.controls.minDistance = 12;
    this.controls.maxDistance = 16000;
    this.controls.target.copy(homeView.target);
    
    // 监听鼠标/触摸事件来区分操作类型
    let isZooming = false;
    
    this.renderer.domElement.addEventListener('wheel', () => {
      isZooming = true;
      setTimeout(() => { isZooming = false; }, 100);
    }, { passive: true });
    
    this.controls.addEventListener('start', () => {
      this.cameraTransition = null;
      if (this.currentTargetPlanet && !isZooming) {
        this.currentTargetPlanet = null;
        this.highlightOrbit(null);
      }
    });
    
    this.setupLighting();
    
    this.starField = createStarfield();
    this.scene.add(this.starField);
    
    this.solarSystem = new THREE.Group();
    this.scene.add(this.solarSystem);
    
    // 加载管理器：所有贴图加载完成后通知 UI 关闭加载页
    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.onProgress = (url, loaded, total) => {
      if (this.onProgress && total > 0) {
        // 前 15% 留给场景初始化，避免加载条长时间停留在 0
        this.onProgress(Math.min(15 + (loaded / total) * 85, 99));
      }
    };
    this.loadingManager.onLoad = () => {
      if (this.onLoaded) this.onLoaded();
    };
    
    this.sun = createSun(this.loadingManager);
    this.sun.castShadow = false;
    this.solarSystem.add(this.sun);
    performance.mark('solar-sun-ready');
    
    // 银河全景背景（在 LoadingManager 中加载，确保所有贴图就绪后再关闭加载页）
    this.scene.background = this.createSpaceBackground(this.loadingManager);
    this._spaceBackground = this.scene.background;
    
    this.planetMeshes = createPlanets(this.solarSystem, this.loadingManager);
    performance.mark('solar-planets-ready');
    performance.mark('solar-geometry-ready');

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.setupResize();
    this.setupClick();

    // 场景结构就绪后先撤掉加载页，让轻量场景海报接管等待期。
    if (this.onSceneReady) this.onSceneReady();
    // 让浏览器先派发贴图请求，再进入首帧渲染，避免着色器编译抢占网络启动。
    window.setTimeout(() => this.animate(), 160);
    this.scheduleDistantObjects();
    this.schedulePostProcessing();
  }

  scheduleDistantObjects() {
    if (this._distantLoader || this.asteroidBelt) return;
    const start = async () => {
      if (this._distantLoader || this.asteroidBelt) return;
      this._distantLoader = Promise.all([
        import('./objects/createAsteroidBelt.js'),
        import('./objects/asteroidTextures.js')
      ]).then(([{ createAsteroidBelt, createKuiperBelt }, { createAsteroidTextures }]) => {
        if (!this.scene) return;
        this.asteroidBelt = createAsteroidBelt(1600, 1850);
        this.kuiperBelt = createKuiperBelt(6500, 7500);
        this.solarSystem.add(this.asteroidBelt, this.kuiperBelt);
        this.namedAsteroids = this.createNamedAsteroids(createAsteroidTextures);
        performance.mark('solar-distant-ready');
      }).catch(error => {
        console.warn('[solar] 外围天体延迟加载失败：', error);
      });
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(start, { timeout: 1800 });
    } else {
      window.setTimeout(start, 700);
    }
  }

  schedulePostProcessing() {
    if (this._postLoader || this.composer) return;
    const start = () => {
      if (this._postLoader) return;
      this._postLoader = import('./postprocessing/createComposer.js')
        .then(({ createComposer }) => {
          if (!this.renderer) return;
          performance.mark('solar-composer-start');
          const pp = createComposer(this.renderer, this.scene, this.camera);
          this.composer = pp.composer;
          this.bloomPass = pp.bloomPass;
          this.godRaysPass = pp.godRaysPass;
          this.chromaticPass = pp.chromaticPass;
          this.colorGradingPass = pp.colorGradingPass;
          this.vignetteGrainPass = pp.vignetteGrainPass;
          this.lensFlarePass = pp.lensFlarePass;
          if (this.lowPower) {
            // 移动端只保留 Bloom，其余高成本全屏通道关闭。
            this.godRaysPass.enabled = false;
            this.chromaticPass.enabled = false;
            this.colorGradingPass.enabled = false;
            this.vignetteGrainPass.enabled = false;
            this.lensFlarePass.enabled = false;
          }
        })
        .catch((error) => {
          console.warn('[solar] 后期管线延迟加载失败，继续使用基础渲染：', error);
        });
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(start, { timeout: 2200 });
    } else {
      window.setTimeout(start, 900);
    }
  }

  // 深空背景：银河全景贴图（等距柱状投影）+ 增亮与星云色调处理
  createSpaceBackground(manager) {
    if (manager) {
      const tex = new THREE.TextureLoader(manager).load(
        import.meta.env.BASE_URL + 'textures/milkyway.webp',
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
      // 克制地提升银河层次，避免背景亮度压过行星主体。
      ctx.filter = 'brightness(1.18) saturate(1.12) contrast(1.08)';
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
    // 低强度环境底光保留暗面细节，让太阳成为明确的主光源。
    const ambientLight = new THREE.AmbientLight(0x71809d, 0.34);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x91a8cf, 0x17120e, 0.28);
    this.scene.add(hemiLight);

    this.sunLight = new THREE.PointLight(0xfff1dc, 4.2, 0, 0);
    this.sunLight.position.set(0, 0, 0);
    // 点光源阴影需要六次立方体渲染；关闭后由材质明暗与土星环着色器承担体积表现。
    this.sunLight.castShadow = false;
    this.scene.add(this.sunLight);

    const fillLight = new THREE.DirectionalLight(0x7d9fc9, 0.22);
    fillLight.position.set(-300, 120, -300);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xb5d5ef, 0.18);
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
          radius: 300
        };
        this.currentTargetPlanet = sunTarget;
        this.moveCameraToPlanet(sunTarget);
        this.onSunClick();
        return;
      }
    });
  }

  moveCameraToPlanet(planet) {
    this.highlightOrbit(planet.parentPlanet?.name || planet.name || null);
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
    // 镜头动画统一进入主渲染循环，避免多个 requestAnimationFrame 相互争抢相机。
    this.cameraTransition = {
      startTime: performance.now(),
      duration: this.prefersReducedMotion ? 1 : 1250,
      startPos: this.camera.position.clone(),
      startTarget: this.controls.target.clone(),
      endPos: targetPos.clone(),
      endTarget: lookAtPos.clone()
    };
    this.controls.enabled = false;
  }

  updateCameraTransition(now) {
    const transition = this.cameraTransition;
    if (!transition) return;
    const progress = Math.min((now - transition.startTime) / transition.duration, 1);
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const endTarget = this._worldPosition.copy(transition.endTarget);
    const endPos = this._transitionDrift.copy(transition.endPos);
    if (this.currentTargetPlanet) {
      const currentWorld = new THREE.Vector3();
      this.currentTargetPlanet.mesh.getWorldPosition(currentWorld);
      const drift = currentWorld.clone().sub(transition.endTarget);
      endTarget.copy(currentWorld);
      endPos.add(drift);
    }

    this.camera.position.lerpVectors(transition.startPos, endPos, eased);
    this.controls.target.lerpVectors(transition.startTarget, endTarget, eased);
    this.camera.lookAt(this.controls.target);
    if (progress >= 1) {
      this.cameraTransition = null;
      this.controls.enabled = !(this.shipSystem && this.shipSystem.enabled);
      this.controls.update();
    }
  }

  setupResize() {
    this._resizeHandler = () => {
      this._adaptiveRatio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(this._adaptiveRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._resizeHandler);
    document.addEventListener('visibilitychange', this._visibilityHandler);
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    // 黑洞体验或后台标签页期间挂起渲染，让出 GPU 与电量。
    if (this.suspended) return;
    if (document.hidden) {
      this.clock.getDelta();
      return;
    }

    // 自适应降载：连续低帧率时降低渲染分辨率，优先保证交互流畅
    const now = performance.now();
    if (!this._lastFrameAt) this._lastFrameAt = now;
    const frameElapsed = now - this._lastFrameAt;
    this._frameCounter++;
    if (frameElapsed >= 2500) {
      const fps = (this._frameCounter * 1000) / frameElapsed;
      if (fps < 27 && this._adaptiveRatio > 1.05) {
        this._adaptiveRatio = Math.max(1, this._adaptiveRatio - 0.25);
        this.renderer.setPixelRatio(this._adaptiveRatio);
      }
      this._frameCounter = 0;
      this._lastFrameAt = now;
    }

    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, 0.05);
    const time = Date.now() * 0.001;
    
    if (!this.isPaused) {
      // 星历推进使用真实帧间隔，保证 1× 始终约等于 1 日/秒，不受刷新率影响。
      const simulationDelta = Math.min(rawDelta, 0.25) * this.timeSpeed;
      this.simulationDays += simulationDelta;
      this.updatePlanets(simulationDelta);
      this.updateSun(simulationDelta);
      if (this.onTimeUpdate && now - this._lastDateEmit > 300) {
        this.onTimeUpdate(this.getSimulationDate());
        this._lastDateEmit = now;
      }
    }
    
    if (this.starField && this.starField.children) {
      // 三层星场：各自旋转速度不同，产生视差
      this.starField.children.forEach(layer => {
        if (layer.userData.material) {
          layer.userData.material.uniforms.time.value = time;
        }
        if (layer.userData.rotSpeed && !this.isPaused && !this.prefersReducedMotion) {
          layer.rotation.y += layer.userData.rotSpeed * delta * this.timeSpeed;
        }
      });
    }
    
    if (this.cameraTransition) {
      this.updateCameraTransition(now);
    } else if (this.shipSystem && this.shipSystem.enabled) {
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

  updatePlanets(simulationDelta = 0) {
    this.planetMeshes.forEach(planet => {
      if (planet.orbitalElements) {
        getOrbitalPosition(
          planet.orbitalElements,
          this.simulationDays,
          planet.distance,
          planet.mesh.position
        );
      }

      if (planet.rotationHours) {
        planet.mesh.rotation.y += (simulationDelta * 24 * Math.PI * 2) / planet.rotationHours;
      }

      if (planet.name === '土星' && planet.ring?.userData.ringMaterial) {
        const saturnWorld = new THREE.Vector3();
        planet.mesh.getWorldPosition(saturnWorld);
        planet.ring.userData.ringMaterial.uniforms.sunDirection.value
          .copy(saturnWorld).multiplyScalar(-1).normalize();
      }

      if (planet.moons && planet.moons.length > 0) {
        planet.moons.forEach((moonEntry) => {
          const cfg = moonEntry.config;
          moonEntry.orbitAngle = (moonEntry.orbitAngle ?? 0) + simulationDelta * cfg.orbitSpeed * 0.35;
          moonEntry.mesh.position.x = cfg.orbitDistance * Math.cos(moonEntry.orbitAngle);
          moonEntry.mesh.position.z = cfg.orbitDistance * Math.sin(moonEntry.orbitAngle);
          moonEntry.mesh.rotation.y += simulationDelta * cfg.rotationSpeed * 12;
        });
      }

      if (planet.name === '地球') {
        if (planet.clouds) planet.clouds.rotation.y += simulationDelta * 0.35;
        if (planet.material?.uniforms?.sunDirection) {
          const earthWorld = new THREE.Vector3();
          planet.mesh.getWorldPosition(earthWorld);
          planet.material.uniforms.sunDirection.value.copy(earthWorld).multiplyScalar(-1).normalize();
        }
        if (planet.atmosphere?.userData.material) {
          const earthWorld = new THREE.Vector3();
          planet.mesh.getWorldPosition(earthWorld);
          planet.atmosphere.userData.material.uniforms.sunDirection.value
            .copy(earthWorld).multiplyScalar(-1).normalize();
        }
      }
    });

    if (this.asteroidBelt) this.asteroidBelt.rotation.y += simulationDelta * 0.018;
    if (this.kuiperBelt) this.kuiperBelt.rotation.y += simulationDelta * 0.006;
    if (this.namedAsteroids) {
      this.namedAsteroids.forEach(asteroid => {
        asteroid.orbitAngle = (asteroid.orbitAngle ?? 0) + simulationDelta * asteroid.orbitSpeed * 0.15;
        asteroid.mesh.position.x = Math.cos(asteroid.orbitAngle) * asteroid.distance;
        asteroid.mesh.position.z = Math.sin(asteroid.orbitAngle) * asteroid.distance;
        asteroid.mesh.rotation.y += simulationDelta * 0.8;
      });
    }
  }

  updateSun(simulationDelta = 0) {
    if (this.sun) {
      this.sun.rotation.y += simulationDelta * 0.25;
      
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
    this.godRaysEnabled = enabled && !this.lowPower;
    if (this.godRaysPass) {
      this.godRaysPass.enabled = this.godRaysEnabled;
      this.godRaysPass.uniforms.intensity.value = this.godRaysEnabled ? 0.55 : 0.0;
    }
  }

  setChromatic(enabled) {
    this.chromaticEnabled = enabled && !this.lowPower;
    if (this.chromaticPass) {
      this.chromaticPass.enabled = this.chromaticEnabled;
      this.chromaticPass.uniforms.amount.value = this.chromaticEnabled ? 0.003 : 0.0;
    }
  }

  setLensFlare(enabled) {
    this.lensFlareEnabled = enabled && !this.lowPower;
    if (this.lensFlarePass) this.lensFlarePass.enabled = this.lensFlareEnabled;
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
      const t = { name: '太阳', mesh: this.sun, radius: 300 };
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

  highlightOrbit(name) {
    this.planetMeshes.forEach(planet => {
      if (!planet.orbit?.material) return;
      planet.orbit.material.opacity = planet.name === name ? 0.78 : (planet.name === '冥王星' ? 0.2 : 0.26);
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
    const home = this.getHomeView();
    this.camera.position.copy(home.position);
    this.controls.target.copy(home.target);
    this.controls.update();
    this.currentTargetPlanet = null;
    this.cameraTransition = null;
    this.controls.enabled = true;
    this.highlightOrbit(null);
  }

  cancelTracking() {
    this.currentTargetPlanet = null;
    this.highlightOrbit(null);
  }

  getPlanetScreenPositions() {
    const positions = {};
    const vector = new THREE.Vector3();
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    const pixelsPerUnit = window.innerHeight / (2 * Math.tan(halfFov));

    const projectBody = (object, name, radius) => {
      vector.setFromMatrixPosition(object.matrixWorld);
      const cameraDistance = Math.max(vector.distanceTo(this.camera.position), 0.001);
      vector.project(this.camera);
      const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
      const screenRadius = (radius * this.globalScale * pixelsPerUnit) / cameraDistance;
      const inView = vector.z > -1 && vector.z < 1 &&
        x > -80 && x < window.innerWidth + 80 &&
        y > -40 && y < window.innerHeight + 80;
      positions[name] = { x, y, radius: screenRadius, visible: this.showNames && inView };
    };

    this.planetMeshes.forEach(planet => projectBody(planet.mesh, planet.name, planet.radius));
    if (this.sun) projectBody(this.sun, '太阳', this.sun.userData.radius || 300);
    this.namedAsteroids.forEach(asteroid => projectBody(asteroid.mesh, asteroid.name, asteroid.radius));

    return positions;
  }

  // 知名小行星：真实比例 + 程序化岩石纹理 + 法线贴图
  createNamedAsteroids(createAsteroidTextures) {
    // 真实直径(km) → 半径(地球=10基准): diameter / 12756 * 10
    const data = [
      { name: '谷神星', distance: 1620, radius: 0.74, orbitSpeed: 0.07, seed: 1, fact: '小行星带最大天体，矮行星，直径940公里，表面有盐类沉积。' },
      { name: '灶神星', distance: 1690, radius: 0.41, orbitSpeed: 0.09, seed: 2, fact: '小行星带第二大战体，直径525公里，南极有巨大撞击坑。' },
      { name: '智神星', distance: 1760, radius: 0.40, orbitSpeed: 0.06, seed: 3, fact: '小行星带第三大战体，直径512公里，轨道倾角高达34°。' },
      { name: '婚神星', distance: 1830, radius: 0.20, orbitSpeed: 0.055, seed: 4, fact: '小行星带第四大战体，直径250公里，以罗马婚姻女神命名。' }
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

  async enableShipMode() {
    if (this.shipSystem?.enabled) return true;
    if (!this.shipSystem) {
      if (!this._shipLoader) {
        this._shipLoader = import('./ship/ShipSystem.js')
          .then(({ ShipSystem }) => {
            if (!this.scene || this.shipSystem) return this.shipSystem;
            this.shipSystem = new ShipSystem(
              this.scene, this.camera, this.renderer,
              this.solarSystem, this.planetMeshes, this.sun,
              { namedAsteroids: this.namedAsteroids }
            );
            return this.shipSystem;
          })
          .finally(() => { this._shipLoader = null; });
      }
      await this._shipLoader;
    }
    if (!this.shipSystem) return false;

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

  shipSwap(shipId) {
    if (this.shipSystem) return this.shipSystem.swapShip(shipId);
    return false;
  }

  getShipId() {
    return this.shipSystem ? this.shipSystem.shipId : 'falcon';
  }

  shipEnterInspect() {
    // 结构检视已全面迁入星舰机库（ShipGarageScene），太空场景不再提供
    return false;
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
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    if (this._visibilityHandler) document.removeEventListener('visibilitychange', this._visibilityHandler);
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
