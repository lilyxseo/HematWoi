import { fileURLToPath } from 'node:url';
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'lucide-react': fileURLToPath(new URL('./src/lib/lucide-to-tabler.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom'
  }
});
