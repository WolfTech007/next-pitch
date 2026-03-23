/**
 * Next Pitch — design tokens (mirror of CSS variables in `globals.css`).
 * Use Tailwind `np-*` utilities where possible; this file documents numeric values for TS/SVG.
 */
export const np = {
  colors: {
    bg: "#060B16",
    bgDeep: "#030712",
    bgGradientTop: "#0A1020",
    bgGradientBottom: "#030712",
    card: "#0B1220",
    panel: "#101A30",
    primaryBlue: "#2563FF",
    accentBlue: "#3B82F6",
    cyan: "#00CFFF",
    text: "#F5F8FF",
    textMuted: "rgba(255,255,255,0.62)",
    border: "rgba(255,255,255,0.08)",
    success: "#22C55E",
    danger: "#EF4444",
    hoverOverlay: "rgba(255,255,255,0.06)",
  },
  radii: {
    card: "20px",
    control: "12px",
    pill: "9999px",
  },
  shadow: {
    card:
      "0 0 0 1px rgba(255,255,255,0.04), 0 14px 44px rgba(0,0,0,0.52), 0 0 72px rgba(37,99,255,0.07)",
    cardHover:
      "0 0 0 1px rgba(255,255,255,0.07), 0 18px 52px rgba(0,0,0,0.55), 0 0 88px rgba(37,99,255,0.11)",
  },
  transition: {
    fast: "150ms ease",
    medium: "220ms ease",
  },
} as const;
