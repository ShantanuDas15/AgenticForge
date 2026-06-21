/** @type {import('tailwindcss').Config} */
export default {
  // Apply Tailwind to every JSX/JS file in src/
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class", // Enables manual dark mode toggle via a class on <html>
  theme: {
    extend: {
      colors: {
        // AgenticForge custom design tokens
        "forge-bg":       "#0a0a0f",   // Deepest background — near black with blue tint
        "forge-surface":  "#12121c",   // Card & panel surfaces
        "forge-border":   "#1e1e2e",   // Subtle borders
        "forge-muted":    "#2a2a3e",   // Muted / inactive states
        "forge-accent":   "#7c3aed",   // Primary purple accent (Planner)
        "forge-coder":    "#0ea5e9",   // Coder agent blue
        "forge-reviewer": "#10b981",   // Reviewer agent emerald
        "forge-error":    "#ef4444",   // Error red
        "forge-text":     "#e2e8f0",   // Primary text
        "forge-muted-text":"#94a3b8",  // Secondary / muted text
      },
      fontFamily: {
        // Modern Google Fonts — add the link tag in index.html (Step 1.6)
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "pulse-slow":    "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":       "fadeIn 0.4s ease-out forwards",
        "slide-up":      "slideUp 0.4s ease-out forwards",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
};
