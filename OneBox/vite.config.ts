import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Polyfill for 'global' (used by amazon-cognito-identity-js, which is
// originally a Node.js library). Vite dev (esbuild) does not inject it by
// default and the app fails silently with "ReferenceError: global is not
// defined". In the browser 'global' is equivalent to 'window'. This is also
// honored by vite build.
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
