import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"] },
      colors: {
        brand: { DEFAULT: "#075B32", deep: "#063A22", light: "#E8F5EE" },
        gold:  { DEFAULT: "#D6A52B", text: "#7A5A0E" },
      },
    },
  },
  plugins: [],
} satisfies Config;
