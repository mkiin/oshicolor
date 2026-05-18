import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: "node",
                    include: ["tests/**/*.test.ts"],
                    exclude: ["tests/**/__browser__/**"],
                    environment: "jsdom",
                },
            },
            {
                extends: true,
                test: {
                    name: "browser",
                    include: ["tests/**/__browser__/**/*.{test,bench}.ts"],
                    exclude: ["library/**", "node_modules/**"],
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        headless: true,
                        instances: [{ browser: "chromium" }],
                    },
                },
            },
        ],
    },
});
