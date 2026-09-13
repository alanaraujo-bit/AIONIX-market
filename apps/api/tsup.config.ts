import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/db/seed.ts"],
  format: ["esm"],
  target: "node24",
  platform: "node",
  sourcemap: true,
  clean: true,
  // Workspace packages are TS source; bundle them into the API output.
  noExternal: [/^@aionix\//],
});
