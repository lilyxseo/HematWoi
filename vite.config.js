import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const projectRootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "lucide-react": path.resolve(
        projectRootDir,
        "src/lib/tabler-lucide-adapter.ts",
      ),
    },
  },
  test: {
    environment: "jsdom",
  },
});
