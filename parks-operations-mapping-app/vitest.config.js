import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // @ea/ui is linked from ../packages/ui: resolve its React/router/icons from
  // this app so there is one copy of each.
  resolve: { dedupe: ['react', 'react-dom', 'react-router-dom', 'lucide-react'] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // Scope discovery to the app. Without this, Vitest's default glob also
    // matches snapshot copies of test files under .superpowers/ (review
    // artifacts) whose relative imports cannot resolve, failing the run.
    include: ['src/**/*.{test,spec}.{js,jsx}', 'server/**/*.test.js'],
  },
})
