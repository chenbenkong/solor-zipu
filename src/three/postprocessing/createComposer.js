import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  GodRaysShader,
  ChromaticAberrationShader,
  ColorGradingShader,
  VignetteGrainShader,
  LensFlareShader
} from './cinematicShaders.js';

// ═══════════════════════════════════════════════════════════════
// 电影级后期处理管线
// 渲染顺序：场景 → 辉光 → 体积光 → 色差 → 色阶 → 暗角颗粒 → ACES输出
// ═══════════════════════════════════════════════════════════════
export function createComposer(renderer, scene, camera) {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  const composer = new EffectComposer(renderer);

  // 1. 场景渲染
  composer.addPass(new RenderPass(scene, camera));

  // 2. Bloom 辉光 — 太阳与高亮区域柔和发光
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.22,  // strength
    0.5,   // radius
    0.82   // threshold
  );
  composer.addPass(bloomPass);

  // 3. God Rays 体积光 — 太阳放射状光柱
  const godRaysPass = new ShaderPass(GodRaysShader);
  composer.addPass(godRaysPass);

  // 4. Chromatic Aberration 色差 — 镜头边缘 RGB 偏移
  const chromaticPass = new ShaderPass(ChromaticAberrationShader);
  composer.addPass(chromaticPass);

  // 5. Color Grading 色阶 — 电影级暗部/中间调/亮部分区调色
  const colorGradingPass = new ShaderPass(ColorGradingShader);
  composer.addPass(colorGradingPass);

  // 6. Vignette + Film Grain 暗角 + 胶片颗粒
  const vignetteGrainPass = new ShaderPass(VignetteGrainShader);
  composer.addPass(vignetteGrainPass);

  // 7. Lens Flare 镜头光晕 — 水平光束 + ghost 光斑
  const lensFlarePass = new ShaderPass(LensFlareShader);
  composer.addPass(lensFlarePass);

  // 8. OutputPass — ACES 色调映射 + sRGB 转换
  composer.addPass(new OutputPass());

  return {
    composer,
    bloomPass,
    godRaysPass,
    chromaticPass,
    colorGradingPass,
    vignetteGrainPass,
    lensFlarePass
  };
}
