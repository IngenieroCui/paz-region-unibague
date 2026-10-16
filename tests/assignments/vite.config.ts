import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
// Production compilation of the exported feature and its worker before router integration.
export default defineConfig({ plugins: [react()], build: {
  outDir: 'tests/assignments/test-results/bundle',
  rollupOptions: { input: resolve(import.meta.dirname, '../../src/features/assignments/AssignmentsWorkspace.tsx'), preserveEntrySignatures: 'strict' },
} })
