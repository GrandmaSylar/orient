import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import _obfuscator from 'vite-plugin-javascript-obfuscator'

const obfuscator = _obfuscator as any

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    obfuscator({
      options: {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: false,
        renameGlobals: false,
        selfDefending: false,
        simplify: true,
        splitStrings: false,
        stringArray: true,
        stringArrayCallsTransform: false,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        unicodeEscapeSequence: false,
        // Prevent obfuscating IPC channel name matches so communication stays working
        reservedStrings: [
          '^lic-.*',
          '^db-.*',
          '^win-.*',
          '^upd-.*'
        ]
      }
    })
  ],
  base: './',
  server: {
    port: 5173,
    strictPort: true
  }
})
