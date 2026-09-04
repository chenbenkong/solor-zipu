import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 让打包后的资源用相对路径，GitHub Pages 项目站点 (/3Dsolar/) 与本地预览都能正确加载
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        // 代码分割：three 与 react 独立分包，首屏并行加载、浏览器可长期缓存
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) return 'vendor-three';
            if (id.includes('react') || id.includes('scheduler') || id.includes('jsxs')) return 'vendor-react';
            return 'vendor';
          }
          return null;
        }
      }
    }
  }
})
