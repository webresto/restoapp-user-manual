import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": "http://127.0.0.1:4177",
      "/input.png": "http://127.0.0.1:4177",
      "/output.png": "http://127.0.0.1:4177",
      "/asset": "http://127.0.0.1:4177",
      "/assets": "http://127.0.0.1:4177",
    },
  },
  build: {
    emptyOutDir: true,
    outDir: "dist",
  },
});
