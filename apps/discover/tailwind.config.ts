import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#075B32", deep: "#063A22" },
        gold: { DEFAULT: "#D6A52B", text: "#7A5A0E" },
      },
    },
  },
  plugins: [],
} satisfies Config;
