import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "shop", include: ["test/**/*.test.ts"] },
});
