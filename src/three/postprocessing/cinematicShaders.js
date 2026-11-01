import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
// 单一合成通道：色差 + 体积光 + 镜头光晕 + 色阶 + 暗角颗粒
//
// 旧实现把五种效果拆成 5 个全屏 Pass（体积光还是 64 次采样），
// 在 1440p、1.75 倍像素比下每帧要多做数倍像素量的纹理读取。
// 这里合并为一个 Pass，体积光采样降到 12 次，观感几乎不变，
// 全屏 Pass 从 6 个降到 1 个。
// ═══════════════════════════════════════════════════════════════
export const CinematicCompositeShader = {
  uniforms: {
    tDiffuse: { value: null },
    sunScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
    godRaysIntensity: { value: 0 },
    sunVisible: { value: 0 },
    chromaticAmount: { value: 0.003 },
    vignetteIntensity: { value: 0.4 },
    vignetteFalloff: { value: 0.8 },
    grainIntensity: { value: 0.016 },
    time: { value: 0 },
    lift: { value: new THREE.Vector3(0.01, 0.005, 0.03) },
    gamma: { value: new THREE.Vector3(1.0, 0.97, 0.92) },
    gain: { value: new THREE.Vector3(1.0, 1.02, 0.98) },
    saturation: { value: 1.15 },
    contrast: { value: 1.08 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 sunScreenPos;
    uniform float godRaysIntensity;
    uniform float sunVisible;
    uniform float chromaticAmount;
    uniform float vignetteIntensity;
    uniform float vignetteFalloff;
    uniform float grainIntensity;
    uniform float time;
    uniform vec3 lift;
    uniform vec3 gamma;
    uniform vec3 gain;
    uniform float saturation;
    uniform float contrast;
    varying vec2 vUv;

    float luminance(vec3 c) {
      return dot(c, vec3(0.2126, 0.7152, 0.0722));
    }

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      // ---- 色差：径向 RGB 偏移，中心几乎无位移 ----
      vec2 dir = vUv - 0.5;
      float dist = length(dir);
      float offset = chromaticAmount * dist * dist;
      vec2 rOffset = vec2(0.0);
      vec2 bOffset = vec2(0.0);
      if (dist > 0.0001) {
        vec2 dirNorm = dir / dist;
        rOffset = dirNorm * offset;
        bOffset = -dirNorm * offset;
      }

      vec3 color;
      color.r = texture2D(tDiffuse, vUv + rOffset).r;
      color.g = texture2D(tDiffuse, vUv).g;
      color.b = texture2D(tDiffuse, vUv + bOffset).b;

      // ---- 体积光：太阳方向 12 次采样径向模糊 ----
      if (godRaysIntensity > 0.001) {
        vec2 delta = (vUv - sunScreenPos) * 0.9 / 12.0;
        vec3 accumulated = vec3(0.0);
        float decay = 1.0;
        vec2 sampleCoord = vUv;
        for (int i = 0; i < 12; i++) {
          sampleCoord -= delta;
          vec3 sampleColor = texture2D(tDiffuse, sampleCoord).rgb;
          sampleColor *= max(sampleColor - vec3(0.6), vec3(0.0));
          accumulated += sampleColor * decay;
          decay *= 0.96;
        }
        color += accumulated * (0.14 / 12.0) * godRaysIntensity * vec3(1.0, 0.7, 0.3);
      }

      // ---- 镜头光晕：水平光束 + 柔光球 + ghost 光斑 ----
      if (sunVisible > 0.01) {
        float dy = vUv.y - sunScreenPos.y;
        float dx = vUv.x - sunScreenPos.x;
        float streak = exp(-abs(dy) * 60.0) * exp(-abs(dx) * 4.0) * 0.035;
        float sunGlow = exp(-sqrt(dx * dx + dy * dy) * 12.0) * 0.12;

        float ghost = 0.0;
        vec2 flareDir = vec2(0.5) - sunScreenPos;
        float dirLen = length(flareDir);
        if (dirLen > 0.001) {
          vec2 nDir = flareDir / dirLen;
          for (int i = 0; i < 4; i++) {
            float fi = float(i);
            vec2 ghostPos = sunScreenPos + nDir * (0.5 + fi * 0.4);
            float spot = exp(-length(vUv - ghostPos) * 20.0);
            ghost += spot * (0.6 + 0.4 * sin(time * 0.8 + fi * 1.5)) * 0.04;
          }
        }

        vec3 flare = vec3(0.75, 0.8, 1.0) * streak
                   + vec3(1.0, 0.85, 0.6) * sunGlow
                   + vec3(0.6, 0.7, 1.0) * ghost;
        color += flare * sunVisible;
      }

      // ---- 电影色阶 ----
      color = color * (1.0 - lift) + lift;
      color = pow(max(color, vec3(0.0)), 1.0 / gamma);
      color *= gain;
      color = (color - 0.18) * contrast + 0.18;
      float lum = luminance(color);
      color = mix(vec3(lum), color, saturation);

      // ---- 暗角 + 胶片颗粒 ----
      float vig = smoothstep(0.5, 0.5 - vignetteFalloff * 0.5, length(vUv - 0.5));
      color *= mix(1.0 - vignetteIntensity, 1.0, vig);
      float grain = rand(vUv * 1000.0 + fract(time * 137.0)) * 2.0 - 1.0;
      color += grain * grainIntensity;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `
};
