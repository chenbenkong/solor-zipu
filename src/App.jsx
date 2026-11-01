import React, { useEffect, useRef, useState, useCallback, lazy, Suspense, Component } from 'react';
import { SolarSystemScene } from './three/SolarSystemScene';
import { ControlPanel } from './components/ControlPanel';
import { PlanetInfo } from './components/PlanetInfo';
import { NavigationPanel } from './components/NavigationPanel';
import { PlanetLabels } from './components/PlanetLabels';
import { Header } from './components/Header';
import { LoadingScreen } from './components/LoadingScreen';
import { CockpitHud } from './components/CockpitHud';
import { GuideModal } from './components/GuideModal';
import { Icon } from './components/Icon';
import { sunInfo, moonInfo, jupiterMoonInfo, saturnMoonInfo } from './data/planetData';
import './styles/index.css';
import './styles/cockpit.css';

// 星舰机库与黑洞属于低频入口，按需加载，避免阻塞首屏。
const BlackHoleOverlay = lazy(() => import('./components/BlackHoleOverlay').then(module => ({ default: module.BlackHoleOverlay })));
const ShipGarageOverlay = lazy(() => import('./components/ShipGarageOverlay').then(module => ({ default: module.ShipGarageOverlay })));

function formatSimulationDate(date) {
  if (!date) return '';
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

const SHIP_NAV_TARGETS = [
  '太阳', '水星', '金星', '地球', '火星', '木星', '土星', '天王星', '海王星', '冥王星',
  '月球', '木卫一（伊奥）', '木卫二（欧罗巴）', '木卫三（盖尼米德）', '木卫四（卡里斯托）',
  '土卫六（泰坦）', '土卫二（恩克拉多斯）', '谷神星', '灶神星', '智神星', '婚神星'
];

// 站点原 BGM（重写前一直在用的那首）：优先用仓库内自托管副本，
// 失败再尝试外链，最后退回本地合成声景，避免任何网络状况下「完全没声」。
const BGM_SOURCES = [
  `${import.meta.env.BASE_URL}audio/bgm.mp3`,
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
];
const BGM_STORAGE_KEY = 'solaris-bgm';

function createBgmAudio(onAllSourcesFailed) {
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0;

  let sourceIndex = 0;
  const loadSource = () => {
    audio.src = BGM_SOURCES[sourceIndex];
  };
  loadSource();

  audio.addEventListener('error', () => {
    sourceIndex += 1;
    if (sourceIndex < BGM_SOURCES.length) {
      loadSource();
      // 换源后继续尝试播放，成功后补上淡入
      audio.play().then(() => fadeAudio(audio, 0.55)).catch(() => {});
    } else if (onAllSourcesFailed) {
      onAllSourcesFailed();
    }
  });

  return audio;
}

function fadeAudio(audio, target, ms = 1400) {
  const from = audio.volume;
  const startedAt = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - startedAt) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (target - from) * t));
    if (t < 1) {
      requestAnimationFrame(step);
    } else if (target === 0) {
      audio.pause();
    }
  };
  requestAnimationFrame(step);
}

function createAmbientSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  const context = new AudioContext();
  const master = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 360;
  filter.Q.value = 0.7;
  filter.connect(master).connect(context.destination);
  master.gain.value = 0;

  const nodes = [58.27, 87.31, 116.54].map((frequency, index) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = index === 0 ? 'sine' : 'triangle';
    osc.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.36 : 0.12;
    osc.connect(gain).connect(filter);
    osc.start();
    return osc;
  });

  const lfo = context.createOscillator();
  const lfoGain = context.createGain();
  lfo.frequency.value = 0.055;
  lfoGain.gain.value = 90;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  return { context, master, stop: () => {
    nodes.forEach((node) => node.stop());
    lfo.stop();
    context.close().catch(() => {});
  } };
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[solaris] 组件渲染异常：', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fatal-error">
          <h2>页面暂时无法运行</h2>
          <p>刷新页面通常可以恢复。若问题持续，请清理浏览器缓存后再试。</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const audioRef = useRef(null);
  const ambienceRef = useRef(null);

  const [isPaused, setIsPaused] = useState(false);
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showStars, setShowStars] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [bloom, setBloom] = useState(true);
  const [lensFlare, setLensFlare] = useState(true);
  const [cinemaMode, setCinemaMode] = useState(false);
  const [globalScale, setGlobalScale] = useState(1);
  const [selectedCelestial, setSelectedCelestial] = useState(null);
  const [planetPositions, setPlanetPositions] = useState(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const isMusicPlayingRef = useRef(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fatalError, setFatalError] = useState(null);
  const [blackHoleMode, setBlackHoleMode] = useState(false);
  const [shipMode, setShipMode] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);
  const [shipHud, setShipHud] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [shipLoading, setShipLoading] = useState(false);
  const [simulationDate, setSimulationDate] = useState(() => formatSimulationDate(new Date()));

  useEffect(() => {
    if (loaded) performance.mark('solaris-ui-ready');
  }, [loaded]);

  useEffect(() => {
    const onError = (event) => setFatalError((prev) => prev || (event.error ? (event.error.message || '页面运行异常') : event.message));
    const onRejection = (event) => setFatalError((prev) => prev || (event.reason ? (event.reason.message || '异步资源加载异常') : '异步资源加载异常'));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const scene = new SolarSystemScene(containerRef.current);
    sceneRef.current = scene;
    scene.onProgress = (progress) => setLoadingProgress(progress);
    scene.onTimeUpdate = (date) => setSimulationDate(formatSimulationDate(date));
    scene.onSceneReady = () => {
      performance.mark('solaris-scene-ready');
      setSceneReady(true);
    };
    scene.onLoaded = () => {
      performance.mark('solaris-assets-ready');
      setLoadingProgress(100);
      setLoaded(true);
    };

    scene.onPlanetClick = (planet) => {
      setSelectedCelestial({
        name: planet.name,
        color: planet.colorHex || '#8a94a6',
        type: planet.type,
        fact: planet.fact,
        realDiameter: planet.realDiameter,
        realDistance: planet.realDistance,
        orbitPeriod: planet.orbitPeriod,
        rotationPeriod: planet.rotationPeriod,
        temperature: planet.temperature,
        moons: planet.moonCount || planet.moons,
        atmosphere: typeof planet.atmosphere === 'string' ? planet.atmosphere : undefined
      });
    };

    scene.onSunClick = () => setSelectedCelestial(sunInfo);
    scene.onMoonClick = (moonName) => setSelectedCelestial(jupiterMoonInfo[moonName] || saturnMoonInfo[moonName] || moonInfo);
    scene.onAsteroidClick = (asteroid) => setSelectedCelestial({
      name: asteroid.name,
      color: '#8a8578',
      type: '小行星',
      fact: asteroid.fact,
      realDiameter: `${Math.round(asteroid.radius * 80)}公里（估算）`,
      realDistance: '小行星带'
    });

    scene.init();

    return () => {
      if (audioRef.current) audioRef.current.stop();
      if (sceneRef.current) sceneRef.current.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (blackHoleMode || garageOpen) {
      setPlanetPositions(null);
      setShipHud(null);
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      if (!sceneRef.current) return;
      setPlanetPositions(showNames ? sceneRef.current.getPlanetScreenPositions() : null);
      setShipHud(sceneRef.current.isShipModeEnabled() ? sceneRef.current.getShipHud() : null);
    }, shipMode ? 90 : 140);
    return () => window.clearInterval(intervalId);
  }, [showNames, shipMode, blackHoleMode, garageOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoadingProgress((progress) => Math.max(progress, 100));
      setSceneReady(true);
      setLoaded(true);
    }, 6000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || guideOpen) return;
      if (shipMode) {
        sceneRef.current?.disableShipMode();
        setShipMode(false);
        setShipHud(null);
      } else if (cinemaMode) {
        setCinemaMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cinemaMode, shipMode, guideOpen]);

  const handleTogglePause = useCallback(() => {
    setIsPaused((previous) => {
      sceneRef.current?.setPaused(!previous);
      return !previous;
    });
  }, []);

  const handleSpeedChange = useCallback((speed) => {
    setTimeSpeed(speed);
    sceneRef.current?.setTimeSpeed(speed);
  }, []);

  const handleResetSimulationTime = useCallback(() => {
    sceneRef.current?.resetSimulationTime();
  }, []);

  const handleZoomChange = useCallback((scale) => {
    setGlobalScale(scale);
    sceneRef.current?.setGlobalScale(scale);
  }, []);

  const makeToggle = useCallback((setter, sceneMethod) => () => {
    setter((previous) => {
      sceneRef.current?.[sceneMethod]?.(!previous);
      return !previous;
    });
  }, []);

  const handleToggleOrbits = makeToggle(setShowOrbits, 'setShowOrbits');
  const handleToggleStars = makeToggle(setShowStars, 'setShowStars');
  const handleToggleNames = makeToggle(setShowNames, 'setShowNames');
  const handleToggleBloom = makeToggle(setBloom, 'setBloom');
  const handleToggleLensFlare = makeToggle(setLensFlare, 'setLensFlare');

  const handleResetView = useCallback(() => {
    sceneRef.current?.resetView();
    setSelectedCelestial(null);
  }, []);

  const handleCloseInfo = useCallback(() => setSelectedCelestial(null), []);
  const handleCancelTracking = useCallback(() => {
    sceneRef.current?.cancelTracking();
    setSelectedCelestial(null);
  }, []);

  const handleFocusByName = useCallback((name) => {
    sceneRef.current?.focusByName(name);
  }, []);

  const handleEnterShipMode = useCallback(async () => {
    if (shipLoading || shipMode) return;
    setShipLoading(true);
    try {
      const ready = await sceneRef.current?.enableShipMode();
      if (ready) {
        setShipMode(true);
        setSelectedCelestial(null);
      }
    } finally {
      setShipLoading(false);
    }
  }, [shipLoading, shipMode]);
  const handleExitShipMode = useCallback(() => {
    sceneRef.current?.disableShipMode();
    setShipMode(false);
    setShipHud(null);
  }, []);
  const handleShipModeChange = useCallback((mode) => sceneRef.current?.shipSetMode(mode), []);
  const handleShipNavSelect = useCallback((name) => sceneRef.current?.shipNavTo(name), []);
  const handleShipCamera = useCallback((mode) => sceneRef.current?.shipSetCamera(mode), []);
  const handleShipConsole = useCallback(() => sceneRef.current?.shipToggleConsole(), []);
  const handleShipCancelNav = useCallback(() => sceneRef.current?.shipCancelNav(), []);
  const handleShipStick = useCallback((x, y) => sceneRef.current?.shipStick?.(x, y), []);
  const handleShipStickRoll = useCallback((value) => sceneRef.current?.shipStickRoll?.(value), []);
  const handleShipThrottle = useCallback((value) => sceneRef.current?.shipThrottle?.(value), []);
  const handleShipOrbit = useCallback((dTheta, dElev, zoomFactor) => sceneRef.current?.shipOrbit?.(dTheta, dElev, zoomFactor), []);
  const handleEnterInspect = useCallback(() => setGarageOpen(true), []);
  const handleGarageConfirm = useCallback((shipId) => {
    setGarageOpen(false);
    sceneRef.current?.shipSwap(shipId);
  }, []);
  const handleGarageExit = useCallback(() => setGarageOpen(false), []);

  const handleEnterBlackHole = useCallback(() => {
    setBlackHoleMode(true);
    setGuideOpen(false);
    sceneRef.current?.setSuspended(true);
  }, []);
  const handleExitBlackHole = useCallback(() => {
    setBlackHoleMode(false);
    sceneRef.current?.setSuspended(false);
  }, []);

  // 外链音乐失败（被墙 / 离线）时的兜底：本地合成声景
  const startAmbience = useCallback(() => {
    if (!ambienceRef.current) ambienceRef.current = createAmbientSound();
    const ambience = ambienceRef.current;
    if (!ambience) return;
    ambience.context.resume().then(() => {
      ambience.master.gain.cancelScheduledValues(ambience.context.currentTime);
      ambience.master.gain.setTargetAtTime(0.06, ambience.context.currentTime, 0.8);
      setIsMusicPlaying(true);
    }).catch(() => {});
  }, []);

  const startBgm = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = createBgmAudio(() => {
        // 自托管与外链都失败时才退回合成声景，避免用户以为「又没声了」
        if (!isMusicPlayingRef.current) return;
        startAmbience();
      });
    }
    const audio = audioRef.current;
    isMusicPlayingRef.current = true;
    setIsMusicPlaying(true);
    localStorage.setItem(BGM_STORAGE_KEY, 'on');
    audio.play().then(() => {
      fadeAudio(audio, 0.55);
    }).catch((error) => {
      // 只有「浏览器拦截自动播放」才回退成关闭状态；
      // 源地址加载失败由 error 事件切换到下一个源，界面保持「开启」。
      if (error && error.name === 'NotAllowedError') {
        isMusicPlayingRef.current = false;
        setIsMusicPlaying(false);
        localStorage.setItem(BGM_STORAGE_KEY, 'off');
      }
    });
  }, [startAmbience]);

  const handleToggleMusic = useCallback(() => {
    if (isMusicPlaying) {
      if (audioRef.current) fadeAudio(audioRef.current, 0);
      if (ambienceRef.current) {
        const ambience = ambienceRef.current;
        ambience.master.gain.setTargetAtTime(0, ambience.context.currentTime, 0.35);
      }
      isMusicPlayingRef.current = false;
      setIsMusicPlaying(false);
      localStorage.setItem(BGM_STORAGE_KEY, 'off');
      return;
    }
    startBgm();
  }, [isMusicPlaying, startBgm]);

  useEffect(() => {
    if (localStorage.getItem(BGM_STORAGE_KEY) !== 'on') return undefined;
    const resume = () => {
      if (!isMusicPlayingRef.current) startBgm();
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
  }, [startBgm]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (shipMode) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.code === 'Space') {
        event.preventDefault();
        handleTogglePause();
      } else if (event.code === 'KeyO') {
        handleToggleOrbits();
      } else if (event.code === 'KeyL') {
        handleToggleNames();
      } else if (event.code === 'KeyR') {
        handleResetView();
      } else if (event.code === 'ArrowUp') {
        event.preventDefault();
        handleSpeedChange(Math.min(timeSpeed + 0.5, 10));
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        handleSpeedChange(Math.max(timeSpeed - 0.5, 0.1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePause, handleSpeedChange, handleToggleOrbits, handleToggleNames, handleResetView, timeSpeed, shipMode]);

  return (
    <ErrorBoundary>
      {fatalError && (
        <div className="fatal-error">
          <h2>页面暂时无法运行</h2>
          <pre>{String(fatalError)}</pre>
          <p>刷新页面通常可以恢复。</p>
        </div>
      )}

      <div className={`app${cinemaMode ? ' cinema-mode' : ''}${selectedCelestial ? ' info-open' : ''}`}>
        <div className="vignette" />
        <div className="grain" />
        <LoadingScreen visible={!sceneReady} progress={sceneReady ? 100 : loadingProgress} />
        <img
          className={`scene-poster${loaded ? ' is-hidden' : ''}`}
          src={`${import.meta.env.BASE_URL}textures/hero-poster.webp`}
          alt=""
          aria-hidden="true"
          decoding="async"
        />
        <div ref={containerRef} className={`canvas-container${loaded ? ' is-ready' : ''}`} />

        {!cinemaMode && !shipMode && (
          <>
            <Header
              speedLevel={timeSpeed}
              simulationDate={simulationDate}
              isPaused={isPaused}
              shipLoading={shipLoading}
              onEnterShip={handleEnterShipMode}
              onBlackHole={handleEnterBlackHole}
              onGuide={() => setGuideOpen(true)}
            />
            <PlanetLabels positions={planetPositions} selectedName={selectedCelestial?.name} />
            <NavigationPanel onSelect={handleFocusByName} selectedName={selectedCelestial?.name} />
            <PlanetInfo celestial={selectedCelestial} onClose={handleCloseInfo} onCancelTracking={handleCancelTracking} />
            <ControlPanel
              isPaused={isPaused}
              timeSpeed={timeSpeed}
              showOrbits={showOrbits}
              showStars={showStars}
              showNames={showNames}
              showBloom={bloom}
              showLensFlare={lensFlare}
              globalScale={globalScale}
              isMusicPlaying={isMusicPlaying}
              shipLoading={shipLoading}
              onTogglePause={handleTogglePause}
              onSpeedChange={handleSpeedChange}
              onZoomChange={handleZoomChange}
              onToggleOrbits={handleToggleOrbits}
              onToggleStars={handleToggleStars}
              onToggleNames={handleToggleNames}
              onToggleBloom={handleToggleBloom}
              onToggleLensFlare={handleToggleLensFlare}
              onResetView={handleResetView}
              onResetSimulationTime={handleResetSimulationTime}
              onToggleMusic={handleToggleMusic}
              onBlackHole={handleEnterBlackHole}
              onEnterShip={handleEnterShipMode}
            />
          </>
        )}

        {!shipMode && (
          <button
            className="cinema-btn"
            onClick={() => setCinemaMode((previous) => !previous)}
            title={cinemaMode ? '退出影院模式 (Esc)' : '进入影院模式'}
            aria-label={cinemaMode ? '退出影院模式' : '进入影院模式'}
          >
            <Icon name={cinemaMode ? 'close' : 'expand'} size={17} />
          </button>
        )}

        {shipMode && shipHud && (
          <CockpitHud
            hud={shipHud}
            planets={SHIP_NAV_TARGETS}
            onModeChange={handleShipModeChange}
            onNavSelect={handleShipNavSelect}
            onToggleCamera={handleShipCamera}
            onToggleConsole={handleShipConsole}
            onCancelNav={handleShipCancelNav}
            onExit={handleExitShipMode}
            onStick={handleShipStick}
            onStickRoll={handleShipStickRoll}
            onStickThrottle={handleShipThrottle}
            onOrbit={handleShipOrbit}
            onEnterInspect={handleEnterInspect}
          />
        )}

        <Suspense fallback={null}>
          {blackHoleMode && <BlackHoleOverlay onExit={handleExitBlackHole} />}
          {garageOpen && (
            <ShipGarageOverlay
              currentShipId={sceneRef.current?.getShipId?.()}
              onConfirm={handleGarageConfirm}
              onExit={handleGarageExit}
            />
          )}
        </Suspense>
        {guideOpen && !blackHoleMode && !shipMode && <GuideModal onClose={() => setGuideOpen(false)} />}
      </div>
    </ErrorBoundary>
  );
}
