import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // @ea/ui is linked from ../packages/ui: resolve its React/router/icons from
  // this app so there is one copy of each.
  resolve: { dedupe: ['react', 'react-dom', 'react-router-dom', 'lucide-react'] },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.js'] },
})
