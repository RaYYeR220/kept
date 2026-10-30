import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "likeness", include: ["test/**/*.test.ts"] },
});
