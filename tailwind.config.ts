import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0F6E56",
          light: "#1D9E75",
          dark: "#085041",
        },
      },
    },
  },
  plugins: [],
};

export default config;
