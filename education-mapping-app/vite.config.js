import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, loadEnv } from 'vite'
import { accessServerPlugin } from './server/vite-plugin.js'
import { APP_BASE_PATH } from './src/config/application.js'

const root = dirname(fileURLToPath(import.meta.url))

function spa404() {
  return {
    name: 'spa-404',
    closeBundle() {
      const index = resolve(root, 'dist/index.html')
      if (existsSync(index)) copyFileSync(index, resolve(root, 'dist/404.html'))
    },
  }
}

/**
 * A locally trusted certificate (mkcert) in .certs, when there is one. The
 * basic-ssl fallback is self-signed and regenerated on restart, so the browser
 * rejected the page's own API calls (ERR_CERT_AUTHORITY_INVALID).
 */
function localHttps() {
  const key = resolve(root, '.certs/dev-key.pem')
  const cert = resolve(root, '.certs/dev-cert.pem')
  if (!existsSync(key) || !existsSync(cert)) return undefined
  return { key: readFileSync(key), cert: readFileSync(cert) }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, root, '')
  process.env.PORTAL_URL ||= env.PORTAL_URL
  process.env.SESSION_SECRET ||= env.SESSION_SECRET
  process.env.PUBLIC_ORIGIN ||= env.PUBLIC_ORIGIN
  process.env.PORTAL_CLIENT_ID ||= env.PORTAL_CLIENT_ID
  process.env.PORTAL_CLIENT_SECRET ||= env.PORTAL_CLIENT_SECRET
  process.env.PORTAL_TOKEN ||= env.PORTAL_TOKEN
  process.env.RUNTIME_CONFIG_PROXY_TARGET ||=
    env.RUNTIME_CONFIG_PROXY_TARGET || 'http://localhost:3000'

  const isVitest = Boolean(process.env.VITEST)
  const tls = localHttps()
  const plugins = [react(), spa404(), accessServerPlugin()]
  if (command === 'serve' && !isVitest && !tls) {
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
    plugins,
    test: {
      environment: 'node',
    },
    server: {
      https: isVitest ? false : tls || true,
      port: 5186,
      strictPort: true,
      // Same-origin proxy for Runtime Config (avoid mixed content on HTTPS UI).
      // Set VITE_RUNTIME_CONFIG_URL to this origin (e.g. https://localhost:5186).
      proxy: configProxy,
    },
    preview: {
      https: tls || true,
      port: 4186,
      proxy: configProxy,
    },
  }
})
