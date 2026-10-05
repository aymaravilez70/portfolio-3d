import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              debugName: 'portfolio-vendors',
              name: (id) => {
                if (/node_modules[\\/]three[\\/]/.test(id)) return 'three-core'
                if (/node_modules[\\/](@react-three|three-stdlib)[\\/]/.test(id)) return 'three-ecosystem'
                if (/node_modules[\\/]/.test(id)) return 'vendor'
                return null
              },
              maxSize: 340 * 1024,
              minSize: 12 * 1024,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
