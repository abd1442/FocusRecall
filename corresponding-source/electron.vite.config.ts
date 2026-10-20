import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const core = { '@core': resolve('src/core') }

export default defineConfig({
  main: {
    define: { __FOCUSRECALL_QA__: JSON.stringify(process.env.FOCUSRECALL_QA_BUILD === '1') },
    plugins: [{name:'build-profile',generateBundle(){this.emitFile({type:'asset',fileName:'build-profile.json',source:JSON.stringify({profile:process.env.FOCUSRECALL_QA_BUILD==='1'?'qa':'production'})})}}],
    resolve: { alias: core }
  },
  preload: {
    resolve: { alias: core }
  },
  renderer: {
    resolve: {
      alias: { ...core, '@renderer': resolve('src/renderer/src') }
    },
    plugins: [react(), tailwindcss()]
  }
})
