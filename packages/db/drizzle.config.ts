import { defineConfig } from "drizzle-kit";

// `pnpm db:generate` writes the next migration from src/schema.ts. It needs no database.
export default defineConfig({
  dialect: "postgresql",
  out: "./src/migrations",
  schema: "./src/schema.ts",
});
