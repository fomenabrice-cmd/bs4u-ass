// Design tokens BS4U — Source de vérité pour Tailwind, CSS variables, composants
// Contrastes WCAG AA/AAA vérifiés selon docs/14_DESIGN_SYSTEM.md

export const bs4uTokens = {
  colors: {
    // Couleurs de marque
    brand: {
      emerald:   "#075B32",   // 8.23:1 sur blanc ✅ AA
      deep:      "#063A22",   // 12.84:1 sur blanc ✅ AAA — sidebar, fonds sombres
      gold:      "#D6A52B",   // JAMAIS texte sur fond blanc (2.26:1 ❌) — accent décoratif
      goldLight: "#F2D477",   // Accents sur fond sombre — 8.84:1 sur brand.deep ✅
      goldText:  "#7A5A0E",   // Variante or lisible sur fond clair — 6.37:1 sur blanc ✅ AA
    },
    // Surfaces
    surface: {
      white:        "#FFFFFF",
      soft:         "#F5F7F5",  // Fond secondaire, zones
      emeraldTint:  "#E8F3EC",  // Sélection, badges succès doux
    },
    // Texte
    text: {
      primary:  "#17231C",  // 16.23:1 ✅ AAA
      muted:    "#66736A",  // 4.97:1 ✅ AA
    },
    // Bordures
    border: {
      subtle: "#E2E8E3",
    },
    // États sémantiques
    state: {
      success: "#067647",   // 5.69:1 ✅ AA
      warning: "#B54708",   // 5.43:1 ✅ AA
      danger:  "#B42318",   // 6.57:1 ✅ AA
      info:    "#175CD3",   // 5.99:1 ✅ AA
    },
    // Opérateurs Mobile Money
    operator: {
      orange: "#FF7900",    // Orange Money — pastille décor uniquement
      mtn:    "#FFCC00",    // MTN MoMo — pastille décor, texte noir par dessus
    },
    // Mode sombre (overrides)
    dark: {
      background: "#0B1410",
      surface:    "#111C17",
      text:       "#E6EDE8",   // 15.73:1 ✅ AAA
      muted:      "#9AA79F",   // 7.49:1 ✅ AA
      primary:    "#3FB27F",   // 7.03:1 ✅ AA
      gold:       "#D6A52B",   // 8.27:1 sur dark.background ✅ AA
    },
  },
  fontFamily: {
    sans: ["Inter", "system-ui", "sans-serif"],
    display: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
    mono: ["JetBrains Mono", "Consolas", "monospace"],
  },
  fontSize: {
    "2xs": ["0.75rem",  { lineHeight: "1rem" }],
    xs:    ["0.875rem", { lineHeight: "1.25rem" }],
    sm:    ["0.875rem", { lineHeight: "1.25rem" }],
    base:  ["1rem",     { lineHeight: "1.5rem" }],
    lg:    ["1.125rem", { lineHeight: "1.75rem" }],
    xl:    ["1.25rem",  { lineHeight: "1.75rem" }],
    "2xl": ["1.5rem",   { lineHeight: "2rem" }],
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
    "4xl": ["2.25rem",  { lineHeight: "2.5rem" }],
    "5xl": ["3rem",     { lineHeight: "1" }],
  },
  spacing: {
    "0":  "0px",
    "1":  "4px",
    "2":  "8px",
    "3":  "12px",
    "4":  "16px",
    "5":  "20px",
    "6":  "24px",
    "8":  "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px",
    "20": "80px",
    "24": "96px",
    "32": "128px",
  },
  borderRadius: {
    none: "0px",
    sm:   "6px",   // Inputs
    DEFAULT: "8px",
    md:   "10px",  // Cartes
    lg:   "16px",  // Modales, cartes membres
    xl:   "24px",
    full: "9999px", // Badges, avatars
  },
  boxShadow: {
    xs:  "0 1px 2px rgba(6, 58, 34, 0.06)",
    sm:  "0 1px 3px rgba(6, 58, 34, 0.1), 0 1px 2px rgba(6, 58, 34, 0.06)",
    md:  "0 4px 6px -1px rgba(6, 58, 34, 0.1), 0 2px 4px -1px rgba(6, 58, 34, 0.06)",
    lg:  "0 10px 15px -3px rgba(6, 58, 34, 0.1), 0 4px 6px -2px rgba(6, 58, 34, 0.05)",
    none: "none",
  },
  screens: {
    sm:  "640px",
    md:  "768px",
    lg:  "1024px",
    xl:  "1280px",
    "2xl": "1536px",
  },
} as const;

export type BS4UColors = typeof bs4uTokens.colors;
