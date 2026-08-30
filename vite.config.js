import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 让打包后的资源用相对路径，GitHub Pages 项目站点 (/3Dsolar/) 与本地预览都能正确加载
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
})
