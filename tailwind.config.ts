import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: "#0a5c36",
          dark: "#063d24",
          light: "#0d7a48",
        },
        card: {
          red: "#dc2626",
          black: "#1a1a1a",
          back: "#2563eb",
        },
      },
      boxShadow: {
        card: "2px 2px 8px rgba(0, 0, 0, 0.3)",
        "card-hover": "4px 4px 12px rgba(0, 0, 0, 0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
