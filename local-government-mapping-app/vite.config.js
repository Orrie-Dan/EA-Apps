import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, loadEnv } from 'vite'
import { accessServerPlugin } from './server/vite-plugin.js'
import { APP_BASE_PATH } from './src/config/application.js'

const root = dirname(fileURLToPath(import.meta.url))
const certFile = resolve(root, 'certs/localhost.pem')
const keyFile = resolve(root, 'certs/localhost-key.pem')
const hasLocalCert = existsSync(certFile) && existsSync(keyFile)

function spa404() {
  return {
    name: 'spa-404',
    closeBundle() {
      const index = resolve(root, 'dist/index.html')
      if (existsSync(index)) copyFileSync(index, resolve(root, 'dist/404.html'))
    },
  }
}

const cors = {
  origin: true,
  credentials: true,
}

const securityHeaders = {
  'Content-Security-Policy': 'frame-ancestors *',
}

export default defineConfig(({ command, mode }) => {
  Object.assign(process.env, loadEnv(mode, root, ''))
  const isVitest = Boolean(process.env.VITEST)
  const https = isVitest
    ? false
    : hasLocalCert
      ? { cert: readFileSync(certFile), key: readFileSync(keyFile) }
      : true

  const plugins = [react(), spa404(), accessServerPlugin()]
  if (command === 'serve' && !isVitest && !hasLocalCert) {
    plugins.splice(1, 0, basicSsl())
  }

  const runtimeConfigTarget =
    process.env.RUNTIME_CONFIG_PROXY_TARGET || 'http://localhost:3000'

  // The Runtime Config backend is reached through this app, under its base.
  const toBackend = {
    target: runtimeConfigTarget,
    changeOrigin: true,
    rewrite: (path) => path.slice(APP_BASE_PATH.length),
  }
  const configProxy = {
    [`${APP_BASE_PATH}/api/v1/config`]: toBackend,
    [`${APP_BASE_PATH}/api/v1/portal-auth`]: toBackend,
  }

  return {
    base: `${APP_BASE_PATH}/`,
    // @ea/ui is linked from ../packages/ui: resolve its React/router/icons from
    // this app so there is one copy of each.
    resolve: { dedupe: ['react', 'react-dom', 'react-router-dom', 'lucide-react'] },
    // Static-file build for hosting ON the portal web server (no app backend).
    // Selected with `--mode static` (npm run build:static); flips VITE_STATIC_BUILD.
    define: {
      'import.meta.env.VITE_STATIC_BUILD': JSON.stringify(mode === 'static' ? '1' : ''),
    },
    plugins: plugins.filter(Boolean),
    test: { environment: 'node' },
    server: {
      https,
      port: 5176,
      strictPort: true,
      cors,
      headers: securityHeaders,
      proxy: configProxy,
    },
    preview: {
      https: https || true,
      port: 4176,
      cors,
      headers: securityHeaders,
      proxy: configProxy,
    },
  }
})
