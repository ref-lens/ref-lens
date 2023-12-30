import path from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  test: {
    globals: true,
  },
  build: {
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, "lib/main.ts"),
      name: "RefLens",
      fileName: (format) => `main.${format}.js`,
    },
    rollupOptions: {
      external: ["react"],
      output: {
        globals: {
          react: "React",
        },
      },
    },
  },
  plugins: [
    dts({
      entryRoot: path.resolve(__dirname, "lib"),
    }),
  ],
});
