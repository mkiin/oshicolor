import { fileURLToPath, URL } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import alchemy from "alchemy/cloudflare/tanstack-start";
import { defineConfig } from "vite-plus";

const config = defineConfig({
    staged: {
        "*": "vp check --fix",
    },
    lint: {
        options: { typeAware: true, typeCheck: true },
        plugins: ["react", "unicorn", "typescript", "import"],
        ignorePatterns: ["src/routeTree.gen.ts", "src/styles.css"],
    },
    fmt: {
        printWidth: 80,
        tabWidth: 4,
        useTabs: false,
        singleQuote: false,
        trailingComma: "all",
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    plugins: [
        devtools(),
        alchemy(),
        tailwindcss(),
        tanstackStart(),
        react(),
        // @ts-expect-error - @rolldown/plugin-babel の型バグ: Pick<babel.InputOptions,...> が
        // Pick<any,...> に解決され全フィールドが必須になる（公式 README 通りの使い方）
        babel({
            presets: [reactCompilerPreset()],
        }),
    ],
});

export default config;
