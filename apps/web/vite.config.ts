import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

const libsRoot = new URL("../../libs/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const webRoot = new URL("./", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      "@cuberub/cube-core": `${libsRoot}cube-core/mod.ts`,
      "@cuberub/cube-input": `${libsRoot}cube-input/mod.ts`,
      "@cuberub/cube-validation": `${libsRoot}cube-validation/mod.ts`,
      "@cuberub/cube-solver": `${libsRoot}cube-solver/mod.ts`,
      "@cuberub/cube-i18n": `${libsRoot}cube-i18n/mod.ts`,
      "@cuberub/cube-storage": `${libsRoot}cube-storage/mod.ts`,
      "@cuberub/cube-application": `${libsRoot}cube-application/mod.ts`,
      "@cuberub/cube-render": `${libsRoot}cube-render/mod.ts`,
      "@cuberub/cube-patterns": `${libsRoot}cube-patterns/mod.ts`,
      "@cuberub/cube-learning": `${libsRoot}cube-learning/mod.ts`,
      "@": webRoot,
    },
  },
  worker: {
    format: "es",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
