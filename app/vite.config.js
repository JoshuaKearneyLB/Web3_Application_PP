import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
  ],
  resolve: {
    alias: {
      // Lets source files import the Anchor-generated IDL from outside the app/ root
      '@idl': resolve(__dirname, '..', 'target', 'idl'),
    },
  },
})
