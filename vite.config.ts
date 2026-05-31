import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Configured dynamically to maintain optimal asset sync states based on active server variables
      hmr: process.env.DISABLE_HMR !== 'true',
      // Dynamic watcher settings based on runtime configuration to optimize CPU utilization
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
