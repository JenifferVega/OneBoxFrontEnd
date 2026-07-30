import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Polyfill para 'global' (lo usa amazon-cognito-identity-js, que originalmente
// es Node.js). Vite dev (esbuild) no lo inyecta por defecto y la app falla en
// blanco con "ReferenceError: global is not defined". En el navegador 'global'
// es equivalente a 'window'. En vite build esto también se respeta.
export default defineConfig({
  define: {
    global: 'window',
  },
  plugins: [
    react({
      babel: {
        plugins: [
          ['@react-dev-inspector/babel-plugin']
        ]
      }
    })
  ]
})
