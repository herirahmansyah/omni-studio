// Vite injects this from the `base` config (see vite.config.ts), always
// ending in '/'. Lets API calls work both standalone (base '/') and when
// mounted under a landing page subpath (base '/transition-studio/').
export const API_BASE = import.meta.env.BASE_URL;
