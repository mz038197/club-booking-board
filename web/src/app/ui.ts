import type { CSSProperties } from "react";

/** Shared inline styles (shadcn-like: zinc palette, 1px borders, 8px radius). */
export const ui = {
  card: {
    background: "#fff",
    border: "1px solid #e4e4e7",
    borderRadius: 8,
    padding: 24,
  },
  muted: { color: "#71717a", fontSize: 14 },
  alert: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 14,
    margin: "0 0 16px",
  },
  buttonPrimary: {
    background: "#18181b",
    color: "#fafafa",
    border: "1px solid #18181b",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 500,
    textDecoration: "none",
    cursor: "pointer",
  },
  buttonOutline: {
    background: "#fff",
    color: "#09090b",
    border: "1px solid #e4e4e7",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 14,
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;
