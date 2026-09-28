import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base` relatif pour que le build fonctionne sur GitHub Pages (sous-dossier du dépôt).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 800 },
});
