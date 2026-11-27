import type { Config } from "tailwindcss";
import { bs4uTokens } from "../../packages/design-tokens/src/tokens";

export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: bs4uTokens.colors,
      fontFamily: bs4uTokens.fontFamily,
      borderRadius: bs4uTokens.borderRadius,
      boxShadow: bs4uTokens.boxShadow,
    },
  },
  plugins: [],
} satisfies Config;
