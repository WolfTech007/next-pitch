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
        "np-pulse-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(37, 99, 255, 0)" },
          "50%": { boxShadow: "0 0 28px 2px rgba(37, 99, 255, 0.25)" },
        },
      },
      animation: {
        "bet-marker-win": "bet-marker-win 2.25s ease-out forwards",
        "bet-marker-lose": "bet-marker-lose 2.25s ease-out forwards",
        "np-pulse": "np-pulse-ring 2.4s ease-in-out infinite",
      },
      colors: {
        np: {
          bg: "#060B16",
          card: "#0B1220",
          panel: "#101A30",
          blue: "#2563FF",
          "blue-bright": "#3B82F6",
          cyan: "#00CFFF",
          text: "#F5F8FF",
          muted: "rgba(255,255,255,0.62)",
          border: "rgba(255,255,255,0.08)",
          success: "#22C55E",
          danger: "#EF4444",
        },
        surface: {
          DEFAULT: "#060B16",
          card: "#0B1220",
          raised: "#101A30",
        },
        accent: {
          green: "#22c55e",
          amber: "#f59e0b",
          red: "#ef4444",
          blue: "#3b82f6",
        },
      },
      boxShadow: {
        "np-card":
          "0 0 0 1px rgba(255,255,255,0.04), 0 14px 44px rgba(0,0,0,0.52), 0 0 72px rgba(37,99,255,0.07)",
        "np-card-lg":
          "0 0 0 1px rgba(255,255,255,0.07), 0 18px 52px rgba(0,0,0,0.55), 0 0 88px rgba(37,99,255,0.11)",
      },
      transitionDuration: {
        np: "200ms",
      },
      borderRadius: {
        "np-card": "20px",
        "np-control": "12px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
