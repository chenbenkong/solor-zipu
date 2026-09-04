import React, { useEffect, useRef, useState, useCallback, Component } from 'react';
import { SolarSystemScene } from './three/SolarSystemScene';
import { ControlPanel } from './components/ControlPanel';
import { PlanetInfo } from './components/PlanetInfo';
import { NavigationPanel } from './components/NavigationPanel';
import { StatusDisplay } from './components/StatusDisplay';
import { PlanetLabels } from './components/PlanetLabels';
import { Header } from './components/Header';
import { LoadingScreen } from './components/LoadingScreen';
import { BlackHoleOverlay } from './components/BlackHoleOverlay';
import { ShipGarageOverlay } from './components/ShipGarageOverlay';
import { CockpitHud } from './components/CockpitHud';
import { sunInfo, moonInfo, jupiterMoonInfo, saturnMoonInfo } from './data/planetData';
import './styles/index.css';
import './styles/cockpit.css';

// 飞船导航目标全集：恒星 + 行星 + 卫星 + 知名小行星
const SHIP_NAV_TARGETS = [
  '太阳',
  '水星', '金星', '地球', '火星', '木星', '土星', '天王星', '海王星', '冥王星',
  '月球',
  '木卫一（伊奥）', '木卫二（欧罗巴）', '木卫三（盖尼米德）', '木卫四（卡里斯托）',
  '土卫六（泰坦）', '土卫二（恩克拉多斯）',
  '谷神星', '灶神星', '智神星', '婚神星'
];

// 错误边界：捕获子组件渲染期异常，避免整页空白（黑屏）且无提示
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[solar] 组件渲染异常：', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fatal-error">
          <h2>页面出错了</h2>
          <pre>{String(this.state.error && this.state.error.stack || this.state.error)}</pre>
          <p>请把上面这段报错发给我，我来修。</p>
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
  const [godRays, setGodRays] = useState(true);
  const [chromatic, setChromatic] = useState(true);
  const [lensFlare, setLensFlare] = useState(true);
  const [cinemaMode, setCinemaMode] = useState(false);
  const [globalScale, setGlobalScale] = useState(1.0);
  const [selectedCelestial, setSelectedCelestial] = useState(null);
  const [planetPositions, setPlanetPositions] = useState(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fatalError, setFatalError] = useState(null);
  const [blackHoleMode, setBlackHoleMode] = useState(false);
  const [shipMode, setShipMode] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false); // 星舰机库选型界面
  const [shipHud, setShipHud] = useState(null);

  // 全局捕获未被 React 边界兜住的运行时错误，直接显示在页面上
  useEffect(() => {
    const onError = (e) => setFatalError((prev) => prev || (e.error ? (e.error.stack || e.error.message) : e.message));
    const onReject = (e) => setFatalError((prev) => prev || (e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : '未知异步错误'));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onReject);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onReject);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new SolarSystemScene(containerRef.current);
    scene.init();
    sceneRef.current = scene;
    scene.onLoaded = () => setLoaded(true);

    scene.onPlanetClick = (planet) => {
      setSelectedCelestial({
        name: planet.name,
        color: planet.colorHex,
        type: planet.type,
        fact: planet.fact,
        realDiameter: planet.realDiameter,
        realDistance: planet.realDistance,
        orbitPeriod: planet.orbitPeriod,
        rotationPeriod: planet.rotationPeriod,
        temperature: planet.temperature,
        moons: planet.moonCount,
        atmosphere: typeof planet.atmosphere === 'string' ? planet.atmosphere : undefined
      });
    };

    scene.onSunClick = () => {
      setSelectedCelestial(sunInfo);
    };

    scene.onMoonClick = (moonName) => {
      if (moonName === '月球') {
        setSelectedCelestial(moonInfo);
      } else if (jupiterMoonInfo[moonName]) {
        setSelectedCelestial(jupiterMoonInfo[moonName]);
      } else if (saturnMoonInfo[moonName]) {
        setSelectedCelestial(saturnMoonInfo[moonName]);
      } else {
        setSelectedCelestial(moonInfo);
      }
    };

    scene.onAsteroidClick = (asteroid) => {
      setSelectedCelestial({
        name: asteroid.name,
        colorHex: '#8a8578',
        type: '小行星',
        fact: asteroid.fact,
        realDiameter: Math.round(asteroid.radius * 80) + '公里（估算）',
        realDistance: '小行星带'
      });
    };

    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    const intervalId = setInterval(() => {
      if (sceneRef.current) {
        const positions = sceneRef.current.getPlanetScreenPositions();
        setPlanetPositions(positions);
        if (sceneRef.current.isShipModeEnabled && sceneRef.current.isShipModeEnabled()) {
          setShipHud(sceneRef.current.getShipHud());
        }
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, []);

  // 兜底：即便个别贴图加载异常，也在 6 秒后强制关闭加载页
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 6000);
    return () => clearTimeout(t);
  }, []);

  // Esc 退出影院模式 / 飞船模式
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
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
  }, [cinemaMode, shipMode]);

  const handleTogglePause = useCallback(() => {
    setIsPaused(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setPaused(newValue);
      }
      return newValue;
    });
  }, []);

  const handleSpeedChange = useCallback((speed) => {
    setTimeSpeed(speed);
    if (sceneRef.current) {
      sceneRef.current.setTimeSpeed(speed);
    }
  }, []);

  const handleZoomChange = useCallback((scale) => {
    setGlobalScale(scale);
    if (sceneRef.current) {
      sceneRef.current.setGlobalScale(scale);
    }
  }, []);

  const handleToggleOrbits = useCallback(() => {
    setShowOrbits(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setShowOrbits(newValue);
      }
      return newValue;
    });
  }, []);

  const handleToggleStars = useCallback(() => {
    setShowStars(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setShowStars(newValue);
      }
      return newValue;
    });
  }, []);

  const handleToggleNames = useCallback(() => {
    setShowNames(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setShowNames(newValue);
      }
      return newValue;
    });
  }, []);

  const handleToggleBloom = useCallback(() => {
    setBloom(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setBloom(newValue);
      }
      return newValue;
    });
  }, []);

  const handleToggleGodRays = useCallback(() => {
    setGodRays(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setGodRays(newValue);
      }
      return newValue;
    });
  }, []);

  const handleToggleChromatic = useCallback(() => {
    setChromatic(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setChromatic(newValue);
      }
      return newValue;
    });
  }, []);

  const handleToggleLensFlare = useCallback(() => {
    setLensFlare(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setLensFlare(newValue);
      }
      return newValue;
    });
  }, []);

  const handleResetView = useCallback(() => {
    if (sceneRef.current) {
      sceneRef.current.resetView();
    }
    setSelectedCelestial(null);
  }, []);

  const handleCloseInfo = useCallback(() => {
    setSelectedCelestial(null);
  }, []);

  const handleCancelTracking = useCallback(() => {
    setSelectedCelestial(null);
    if (sceneRef.current) {
      sceneRef.current.cancelTracking();
    }
  }, []);

  /* ================= 星际飞船模式 ================= */

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

  const handleShipModeChange = useCallback((m) => {
    sceneRef.current?.shipSetMode(m);
  }, []);

  const handleShipNavSelect = useCallback((name) => {
    sceneRef.current?.shipNavTo(name);
  }, []);

  const handleShipCamera = useCallback((m) => {
    sceneRef.current?.shipSetCamera(m);
  }, []);

  const handleShipConsole = useCallback(() => {
    sceneRef.current?.shipToggleConsole();
  }, []);

  const handleShipCancelNav = useCallback(() => {
    sceneRef.current?.shipCancelNav();
  }, []);

  const handleShipStick = useCallback((x, y) => {
    sceneRef.current?.shipStick?.(x, y);
  }, []);

  const handleShipStickRoll = useCallback((v) => {
    sceneRef.current?.shipStickRoll?.(v);
  }, []);

  const handleShipThrottle = useCallback((v) => {
    sceneRef.current?.shipThrottle?.(v);
  }, []);

  const handleShipOrbit = useCallback((dTheta, dElev, zoomFactor) => {
    sceneRef.current?.shipOrbit?.(dTheta, dElev, zoomFactor);
  }, []);

  /* ---------- 星舰机库（选型 + 结构检视均在机库内完成） ---------- */
  const handleEnterInspect = useCallback(() => setGarageOpen(true), []);
  const handleGarageConfirm = useCallback((shipId) => {
    setGarageOpen(false);
    // 换船后直接以新座舰回到太空飞行
    sceneRef.current?.shipSwap(shipId);
  }, []);
  const handleGarageExit = useCallback(() => setGarageOpen(false), []);

  // 进入黑洞体验：挂起太阳系渲染（省 GPU），卸载时恢复
  const handleEnterBlackHole = useCallback(() => {
    setBlackHoleMode(true);
    if (sceneRef.current) sceneRef.current.setSuspended(true);
  }, []);

  const handleExitBlackHole = useCallback(() => {
    setBlackHoleMode(false);
    if (sceneRef.current) sceneRef.current.setSuspended(false);
  }, []);

  const handleToggleMusic = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
      audioRef.current.loop = true;
    }

    if (isMusicPlaying) {
      audioRef.current.pause();
      setIsMusicPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsMusicPlaying(true);
    }
  }, [isMusicPlaying]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (shipMode) return; // 飞船模式下由飞船系统接管键盘
      if (event.code === 'Space') {
        event.preventDefault();
        handleTogglePause();
      } else if (event.code === 'ArrowUp') {
        event.preventDefault();
        const newSpeed = Math.min(timeSpeed + 0.5, 10);
        handleSpeedChange(newSpeed);
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        const newSpeed = Math.max(timeSpeed - 0.5, 0.1);
        handleSpeedChange(newSpeed);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePause, handleSpeedChange, timeSpeed, shipMode]);

  return (
    <ErrorBoundary>
      {fatalError && (
        <div className="fatal-error">
          <h2>页面运行时出错</h2>
          <pre>{String(fatalError)}</pre>
          <p>请把上面这段报错发给我，我来定位修复。</p>
        </div>
      )}
      <div className="app">
      <div className="vignette" />
      <div className="grain" />
      <LoadingScreen visible={!loaded} progress={loaded ? 100 : 35} />

      <div ref={containerRef} className="canvas-container" />

      {!cinemaMode && !shipMode && (
        <>
          <Header zoomLevel={globalScale} speedLevel={timeSpeed} isPaused={isPaused} />
          <StatusDisplay zoomLevel={globalScale} speedLevel={timeSpeed} />
          <PlanetLabels positions={planetPositions} />
          <NavigationPanel onSelect={(name) => sceneRef.current?.focusByName(name)} />
          <PlanetInfo
            celestial={selectedCelestial}
            onClose={handleCloseInfo}
            onCancelTracking={handleCancelTracking}
          />
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
            onToggleMusic={handleToggleMusic}
            onBlackHole={handleEnterBlackHole}
            onEnterShip={handleEnterShipMode}
          />
        </>
      )}

      {/* 影院模式切换按钮：太阳系模式可见（飞船模式隐藏，避免遮挡驾驶舱 HUD） */}
      {!shipMode && (
        <button
          className="cinema-btn"
          onClick={() => setCinemaMode(prev => !prev)}
          title={cinemaMode ? '退出影院模式 (Esc)' : '影院模式：隐藏所有 UI'}
        >
          {cinemaMode ? '✕' : '◎'}
        </button>
      )}

      {/* 飞船模式入口已移至底部控制栏（ControlPanel） */}

      {/* 飞船驾驶舱 HUD */}
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

      {/* 星舰机库：独立选型空间 */}
      {garageOpen && (
        <ShipGarageOverlay
          currentShipId={sceneRef.current?.getShipId?.()}
          onConfirm={handleGarageConfirm}
          onExit={handleGarageExit}
        />
      )}
      </div>
    </ErrorBoundary>
  );
}
