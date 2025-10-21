import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "lucide-react": path.resolve(__dirname, "src/lib/tabler-lucide-adapter.ts"),
    },
  },
  test: {
    environment: 'jsdom'
  }
});
