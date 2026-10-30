import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "youcam", include: ["test/**/*.test.ts"] },
});
