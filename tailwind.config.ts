import type { Config } from "tailwindcss";
import { BRAND } from "./lib/config.ts";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          black: BRAND.colors.black,
          white: BRAND.colors.white,
          safety: BRAND.colors.safety,
          cleaning: BRAND.colors.cleaning,
          social: BRAND.colors.social,
          parks: BRAND.colors.parks
        }
      },
      boxShadow: {
        "card-hard": "0 10px 28px rgba(0,0,0,0.14)",
        "card-soft": "0 6px 20px rgba(0,0,0,0.08)"
      },
      backgroundImage: {
        "grid-overlay": "linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
