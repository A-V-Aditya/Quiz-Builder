// Automatically use /api if running under Vite dev server (via proxy), or fallback to direct port 5000
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173' ? '/api' : 'http://localhost:5000/api');
