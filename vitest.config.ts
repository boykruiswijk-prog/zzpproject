import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    // Satori's CJS export gives its WASM dependency Node's __dirname without mocking images.
    alias: { "@": path.resolve(__dirname, "./src"), satori: path.resolve(__dirname, "node_modules/satori/dist/index.cjs") },
  },
});
