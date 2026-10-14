import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { accessServerPlugin } from './server/vite-plugin.js'
import { APP_BASE_PATH } from './src/config/application.js'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command, mode }) => {
  Object.assign(process.env, loadEnv(mode, root, ''))
  const isVitest = Boolean(process.env.VITEST)
  // Static-file build for hosting ON the portal web server (no app backend).
  // Selected with `--mode static` (npm run build:static); flips VITE_STATIC_BUILD.
  const isStatic = mode === 'static'
  const plugins = [react(), accessServerPlugin()]
  if (command === 'serve' && !isVitest) {
    plugins.unshift(basicSsl())
  }

  // The Runtime Config backend is reached through this app, under its base.
  const toBackend = {
    target: process.env.RUNTIME_CONFIG_PROXY_TARGET || 'http://localhost:3000',
    changeOrigin: true,
    rewrite: (path) => path.slice(APP_BASE_PATH.length),
  }
  const configProxy = {
    [`${APP_BASE_PATH}/api/v1/config`]: toBackend,
    [`${APP_BASE_PATH}/api/v1/portal-auth`]: toBackend,
  }

  return {
    base: `${APP_BASE_PATH}/`,
    plugins,
    define: {
      'import.meta.env.VITE_STATIC_BUILD': JSON.stringify(isStatic ? '1' : ''),
    },
    test: { environment: 'node' },
    server: {
      https: !isVitest,
      port: 5181,
      strictPort: true,
      proxy: configProxy,
    },
    preview: {
      https: true,
      port: 4181,
      proxy: configProxy,
    },
  }
})
