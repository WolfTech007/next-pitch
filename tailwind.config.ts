import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "bet-marker-win": {
          "0%": {
            opacity: "1",
            stroke: "#ffffff",
            filter: "drop-shadow(0 0 2px rgb(255 255 255))",
          },
          "20%": {
            stroke: "#4ade80",
            filter:
              "drop-shadow(0 0 12px rgb(74 222 128)) drop-shadow(0 0 24px rgb(34 197 94))",
          },
          "50%": {
            opacity: "1",
            stroke: "#4ade80",
            filter: "drop-shadow(0 0 8px rgb(74 222 128))",
          },
          "100%": {
            opacity: "0",
            stroke: "#22c55e",
            filter: "none",
          },
        },
        "bet-marker-lose": {
          "0%": {
            opacity: "1",
            stroke: "#ffffff",
            filter: "drop-shadow(0 0 2px rgb(255 255 255))",
          },
          "20%": {
            stroke: "#f87171",
            filter:
              "drop-shadow(0 0 12px rgb(248 113 113)) drop-shadow(0 0 24px rgb(239 68 68))",
          },
          "50%": {
            opacity: "1",
            stroke: "#f87171",
            filter: "drop-shadow(0 0 8px rgb(248 113 113))",
          },
          "100%": {
            opacity: "0",
            stroke: "#ef4444",
            filter: "none",
          },
        },
      },
      animation: {
        "bet-marker-win": "bet-marker-win 2.25s ease-out forwards",
        "bet-marker-lose": "bet-marker-lose 2.25s ease-out forwards",
      },
      colors: {
        // Dark sportsbook-inspired palette
        surface: {
          DEFAULT: "#0c0f14",
          card: "#12171f",
          raised: "#1a2029",
        },
        accent: {
          green: "#22c55e",
          amber: "#f59e0b",
          red: "#ef4444",
          blue: "#38bdf8",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
