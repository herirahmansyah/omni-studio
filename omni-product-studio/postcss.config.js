// Local PostCSS config. Isolates this project from a PostCSS config found
// higher up in the directory tree (which referenced autoprefixer from a
// location that doesn't have it). Tailwind is handled by @tailwindcss/vite,
// not through PostCSS.
export default {
  plugins: {
    autoprefixer: {},
  },
};