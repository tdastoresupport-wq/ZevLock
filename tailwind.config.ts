import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#05060f",
        abyss: "#0a0d1f",
        violet2: "#8b5cf6",
        cyan2: "#22d3ee",
      },
    },
  },
  plugins: [],
};

export default config;
