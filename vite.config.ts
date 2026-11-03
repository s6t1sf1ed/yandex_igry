import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    assetsDir: "assets",
    sourcemap: false,
    target: "es2020",
  },
});

