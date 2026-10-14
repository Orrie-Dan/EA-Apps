import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, loadEnv } from 'vite'
import { accessServerPlugin } from './server/vite-plugin.js'
import { APP_BASE_PATH } from './src/config/application.js'

export default defineConfig(({ command, mode }) => {
  // The proxy is built here, before the access plugin copies .env into
  // process.env, so read the backend target from .env directly.
  process.env.RUNTIME_CONFIG_PROXY_TARGET ||=
    loadEnv(mode, process.cwd(), '').RUNTIME_CONFIG_PROXY_TARGET
  const isVitest = Boolean(process.env.VITEST)
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
    // Static-file build for hosting ON the portal web server (no app backend).
    // Selected with `--mode static` (npm run build:static); flips VITE_STATIC_BUILD.
    define: {
      'import.meta.env.VITE_STATIC_BUILD': JSON.stringify(mode === 'static' ? '1' : ''),
    },
    plugins,
    test: { environment: 'node' },
    server: {
      https: !isVitest,
      port: 5175,
      strictPort: true,
      proxy: configProxy,
    },
    preview: {
      https: true,
      port: 4175,
      proxy: configProxy,
    },
  }
})
