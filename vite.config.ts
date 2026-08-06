import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isGitHubPages = process.env.STILL_DEPLOY_TARGET === 'github-pages';

export default defineConfig({
  base: isGitHubPages ? '/still/' : '/',
  plugins: [react()],
});
