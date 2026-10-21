import { defineConfig } from 'vite'

// GitHub Pages 部署在 /rookie-birder/ 底下；本地開發用根路徑
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: { chunkSizeWarningLimit: 900 },
})
