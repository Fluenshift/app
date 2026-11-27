import { defineConfig } from "tsdown";

// The server for the container, and the one-time import of PE's local history (src/import-pe.ts).
// Workspace packages ship TypeScript sources, so they are bundled.
// Every npm package they import stays external and is a dependency of this package too, so
// that Node finds it beside the bundle: a package that would be bundled fails the build.
export default defineConfig({
  entry: ["src/index.ts", "src/import-pe.ts"],
  format: "esm",
  platform: "node",
  target: "node26",
  deps: { alwaysBundle: [/^@grifando\//u], onlyBundle: [] },
});
