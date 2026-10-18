import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5173,
    host: true,
    // Le serveur de l'agent est relayé sur le tailnet par `tailscale serve` du NAS.
    allowedHosts: ['.ts.net'],
    headers: {
      // Required for SharedArrayBuffer which Stockfish WASM may use
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  }
})
