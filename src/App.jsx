import React, { useEffect, useRef, useState, useCallback, Component } from 'react';
import { SolarSystemScene } from './three/SolarSystemScene';
import { ControlPanel } from './components/ControlPanel';
import { PlanetInfo } from './components/PlanetInfo';
import { NavigationPanel } from './components/NavigationPanel';
import { PlanetLabels } from './components/PlanetLabels';
import { Header } from './components/Header';
import { LoadingScreen } from './components/LoadingScreen';
import { BlackHoleOverlay } from './components/BlackHoleOverlay';
import { ShipGarageOverlay } from './components/ShipGarageOverlay';
import { CockpitHud } from './components/CockpitHud';
import { PlanetQuickNav } from './components/PlanetQuickNav';
import { GuideModal } from './components/GuideModal';
import { Icon } from './components/Icon';
import { sunInfo, moonInfo, jupiterMoonInfo, saturnMoonInfo } from './data/planetData';
import './styles/index.css';
import './styles/cockpit.css';

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
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [fatalError, setFatalError] = useState(null);
  const [blackHoleMode, setBlackHoleMode] = useState(false);
  const [shipMode, setShipMode] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);
  const [shipHud, setShipHud] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [simulationDate, setSimulationDate] = useState(() => formatSimulationDate(new Date()));

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
    scene.onLoaded = () => {
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
      setLoaded(true);
    }, 12000);
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

  const handleEnterShipMode = useCallback(() => {
    if (sceneRef.current?.enableShipMode()) {
      setShipMode(true);
      setSelectedCelestial(null);
    }
  }, []);
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

  const handleToggleMusic = useCallback(() => {
    if (isMusicPlaying) {
      audioRef.current?.master.gain.setTargetAtTime(0, audioRef.current.context.currentTime, 0.35);
      setIsMusicPlaying(false);
      return;
    }
    if (!audioRef.current) audioRef.current = createAmbientSound();
    const audio = audioRef.current;
    if (!audio) return;
    audio.context.resume().then(() => {
      audio.master.gain.cancelScheduledValues(audio.context.currentTime);
      audio.master.gain.setTargetAtTime(0.055, audio.context.currentTime, 0.8);
    }).catch(console.error);
    setIsMusicPlaying(true);
  }, [isMusicPlaying]);

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
        <LoadingScreen visible={!loaded} progress={loaded ? 100 : loadingProgress} />
        <div ref={containerRef} className="canvas-container" />

        {!cinemaMode && !shipMode && (
          <>
            <Header
              speedLevel={timeSpeed}
              simulationDate={simulationDate}
              isPaused={isPaused}
              onEnterShip={handleEnterShipMode}
              onBlackHole={handleEnterBlackHole}
              onGuide={() => setGuideOpen(true)}
            />
            {!selectedCelestial && (
              <section className="scene-intro" aria-label="网站介绍">
                <div className="eyebrow">HELIOCENTRIC OBSERVATORY · 001</div>
                <h1>穿越 45 亿年的<br /><span>秩序与光</span></h1>
                <p>沿真实轨道抵达每一颗世界，点击天体查看完整观测档案。</p>
                <div className="intro-metrics" aria-label="太阳系概览">
                  <span><strong>08</strong>行星</span>
                  <span><strong>21</strong>天体</span>
                  <span><strong>J2000</strong>星历</span>
                </div>
              </section>
            )}
            <PlanetLabels positions={planetPositions} />
            <NavigationPanel onSelect={handleFocusByName} selectedName={selectedCelestial?.name} />
            <PlanetInfo celestial={selectedCelestial} onClose={handleCloseInfo} onCancelTracking={handleCancelTracking} />
            <PlanetQuickNav selectedName={selectedCelestial?.name} onSelect={handleFocusByName} />
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

        {blackHoleMode && <BlackHoleOverlay onExit={handleExitBlackHole} />}
        {garageOpen && (
          <ShipGarageOverlay
            currentShipId={sceneRef.current?.getShipId?.()}
            onConfirm={handleGarageConfirm}
            onExit={handleGarageExit}
          />
        )}
        {guideOpen && !blackHoleMode && !shipMode && <GuideModal onClose={() => setGuideOpen(false)} />}
      </div>
    </ErrorBoundary>
  );
}
