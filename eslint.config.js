import eslint from "@eslint/js";
import perfectionist from "eslint-plugin-perfectionist";

export default [
    {
        files: ["src/**/*.js", "src/**/*.mjs", "src/**/*.cjs"],
        ...eslint.configs.recommended,
        ...perfectionist.configs["recommended-natural"],
    },
];
