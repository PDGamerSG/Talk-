// electron-vite uses electron.vite.config.ts for its multi-target build.
// This file is kept for editor tooling / direct `vite` invocations on the renderer.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron')
    }
  }
});
