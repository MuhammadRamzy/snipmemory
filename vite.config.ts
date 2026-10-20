import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// One Vite build produces both the React SPA (web/) and the Worker (worker/),
// and `vite dev` runs the Worker inside workerd with local D1 + R2 bindings.
export default defineConfig({
  publicDir: 'web/public',
  plugins: [react(), tailwindcss(), cloudflare()],
});
