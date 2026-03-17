import { fileURLToPath, URL } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import alchemy from "alchemy/cloudflare/tanstack-start";
import { defineConfig } from "vite-plus";

const config = defineConfig({
    run: {
        tasks: {
            deploy: {
                command: "alchemy deploy --stage $STAGE --adopt",
                cache: false,
            },
        },
    },
    staged: {
        "*": "vp check --fix",
    },
    lint: {
        options: { typeAware: true, typeCheck: true },
        plugins: ["react", "unicorn", "typescript", "import"],
        ignorePatterns: ["src/routeTree.gen.ts", "src/styles.css", "docs/**"],
    },
    fmt: {
        ignorePatterns: ["src/routeTree.gen.ts", "src/styles.css", "docs/**"],
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
        viteReact(),
        // @ts-expect-error - @rolldown/plugin-babel の型バグ: Pick<any,...> で全フィールドが必須になる
        babel({ presets: [reactCompilerPreset()] }),
    ],
});

export default config;
