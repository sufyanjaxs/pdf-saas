import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts'],
    environment: 'node',
    server: {
      deps: {
        inline: [/@cantoo\/pdf-lib/],
      },
    },
  },
})
