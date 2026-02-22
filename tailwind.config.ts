import type { Config } from "tailwindcss";

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
          black: "#000000",
          white: "#FFFFFF",
          safety: "#FFF300",
          social: "#FF3087",
          parks: "#44D62C"
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
