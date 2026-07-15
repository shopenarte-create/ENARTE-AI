export const colors = {
  ivory: "#f7f3ec",
  beige: "#efe8dc",
  cream: "#faf7f2",
  white: "#fffcf8",
  gold: "#c4a35a",
  goldDeep: "#9a7b3c",
  charcoal: "#1c1914",
  ink: "#2a2620",
  muted: "#6b6560",
  line: "rgba(28, 25, 20, 0.1)",
  danger: "#8a2f2f",
  success: "#2f6b4f",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const typography = {
  brand: {
    fontSize: 36,
    letterSpacing: 6,
    fontWeight: "600" as const,
    color: colors.charcoal,
  },
  display: {
    fontSize: 26,
    fontWeight: "700" as const,
    color: colors.charcoal,
    lineHeight: 34,
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: colors.charcoal,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.muted,
  },
  price: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: colors.goldDeep,
  },
  caption: {
    fontSize: 12,
    color: colors.muted,
  },
};
