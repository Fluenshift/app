import { defineConfig } from "tsdown";

// One file for the container: workspace packages ship TypeScript sources, so they are bundled.
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node26",
  noExternal: [/^@fluenshift\//u],
});
