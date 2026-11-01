import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CinematicCompositeShader } from './cinematicShaders.js';

// ═══════════════════════════════════════════════════════════════
// 电影级后期处理管线
// 渲染顺序：场景 → 辉光 → 合成（色差/体积光/光晕/色阶/暗角）→ ACES 输出
// 只保留 2 个后处理 Pass，避免全屏通道过多造成的掉帧。
// ═══════════════════════════════════════════════════════════════
export function createComposer(renderer, scene, camera) {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  const composer = new EffectComposer(renderer);
  // 后期管线内部已是全屏渲染，MSAA 只会在离屏目标上白付显存
  composer.renderTarget1.texture.generateMipmaps = false;
  composer.renderTarget2.texture.generateMipmaps = false;

  // 1. 场景渲染
  composer.addPass(new RenderPass(scene, camera));

  // 2. Bloom 辉光 — 太阳与高亮区域柔和发光
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.42,  // strength
    0.55,  // radius
    0.78   // threshold
  );
  composer.addPass(bloomPass);

  // 3. 合成通道 — 一次全屏 Pass 完成全部镜头效果
  const cinematicPass = new ShaderPass(CinematicCompositeShader);
  composer.addPass(cinematicPass);

  // 4. OutputPass — ACES 色调映射 + sRGB 转换
  composer.addPass(new OutputPass());

  return { composer, bloomPass, cinematicPass };
}
