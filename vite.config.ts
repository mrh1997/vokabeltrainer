import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site under /vokabeltrainer; the dev server runs at the root.
const base = process.env.NODE_ENV === 'production' ? '/vokabeltrainer' : '';

export default defineConfig({
	plugins: [
		sveltekit({
			// Single-page app: GitHub Pages delivers 404.html for every unknown path,
			// which boots the app so deep links and reloads work.
			adapter: adapter({ fallback: '404.html' }),
			// absolute asset URLs, so the offline app shell works at any URL depth
			paths: { base, relative: false }
		})
	],
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
