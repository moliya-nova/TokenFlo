import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts')
        },
        external: ['electron']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          settings: resolve(__dirname, 'electron/preload/settings.ts'),
          floating: resolve(__dirname, 'electron/preload/floating.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    build: {
      rollupOptions: {
        input: {
          settings: resolve(__dirname, 'src/windows/settings/index.html'),
          floating: resolve(__dirname, 'src/windows/floating/index.html')
        }
      }
    },
    server: {
      host: '127.0.0.1',
      port: 9123
    },
    plugins: [vue()]
  }
})
