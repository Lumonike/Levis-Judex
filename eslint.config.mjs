// @ts-check

import eslint from "@eslint/js";
import perfectionist from "eslint-plugin-perfectionist";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const tsFiles = ["src/**/*.ts", "tests/**/*.ts"];
const withTsFiles = (configs) => configs.map((config) => ({ ...config, files: tsFiles }));

export default defineConfig(
    {
        ignores: ["dist/**", "eslint.config.mjs", "node_modules/**"],
    },
    eslint.configs.recommended,
    ...withTsFiles(tseslint.configs.strictTypeChecked),
    ...withTsFiles(tseslint.configs.stylisticTypeChecked),
    {
        files: tsFiles,
        languageOptions: {
            parserOptions: {
                project: ["./tsconfig.eslint.json"],
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        files: ["public/**/*.js"],
        languageOptions: {
            globals: {
                EventSource: "readonly",
                FileReader: "readonly",
                Option: "readonly",
                SUNEDITOR: "readonly",
                ace: "readonly",
                alert: "readonly",
                clearInterval: "readonly",
                confirm: "readonly",
                console: "readonly",
                document: "readonly",
                fetch: "readonly",
                katex: "readonly",
                scroll: "readonly",
                setInterval: "readonly",
                window: "readonly",
            },
            sourceType: "module",
        },
    },
    {
        ...perfectionist.configs["recommended-natural"],
        files: tsFiles,
    },
);
