import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages project sites live under /<repo>/; the Pages workflow sets BASE_PATH accordingly.
  base: process.env.BASE_PATH ?? '/',
  test: { include: ['tests/**/*.test.ts'] },
})
