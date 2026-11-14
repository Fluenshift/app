import { defineConfig } from "tsdown";

// One file for the container. Workspace packages ship TypeScript sources, so they are bundled.
// Every npm package they import stays external and is a dependency of this package too, so
// that Node finds it beside the bundle: a package that would be bundled fails the build.
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node26",
  deps: { alwaysBundle: [/^@fluenshift\//u], onlyBundle: [] },
});
