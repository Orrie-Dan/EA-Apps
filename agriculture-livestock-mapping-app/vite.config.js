import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { accessServerPlugin } from './server/vite-plugin.js'
import { APP_BASE_PATH } from './src/config/application.js'

function localHttps() {
  const key = path.resolve('.certs/dev-key.pem')
  const cert = path.resolve('.certs/dev-cert.pem')
  if (!fs.existsSync(key) || !fs.existsSync(cert)) return undefined
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) }
}

export default defineConfig(({ mode }) => {
  // Server-side config only. These are NEVER exposed to the browser: they are
  // read by the access server in-process, and carry no VITE_ prefix, so Vite
  // will not inline them into the client bundle.
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of [
    'PORTAL_URL',
    'PUBLIC_ORIGIN',
    'SESSION_SECRET',
    'PORTAL_CLIENT_ID',
    'PORTAL_CLIENT_SECRET',
  ]) {
    process.env[key] ||= env[key]
  }
  process.env.RUNTIME_CONFIG_PROXY_TARGET ||=
    env.RUNTIME_CONFIG_PROXY_TARGET || 'http://localhost:3000'

  // The Runtime Config backend is reached through this app, under its base.
  const toBackend = {
    target: process.env.RUNTIME_CONFIG_PROXY_TARGET,
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
    plugins: [react(), accessServerPlugin()],
    server: {
      port: 5174,
      strictPort: true,
      https: localHttps(),
      proxy: configProxy,
    },
    preview: {
      port: 4174,
      https: localHttps(),
      proxy: configProxy,
    },
  }
})
