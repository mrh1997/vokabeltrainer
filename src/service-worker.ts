/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/**
 * Caches the app itself so it starts without network. Vocabulary and audio
 * live in IndexedDB; dictionary requests always go to the network.
 */
import { assets, immutable } from '$app/manifest';
import { version } from '$app/env';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `app-${version}`;
// Manifest paths are relative to the base path, i.e. to this worker's location.
const absolute = (path: string) => new URL(path, sw.location.href).pathname;
const SHELL = absolute('404.html');
const ASSETS = [...immutable, ...assets].map((a) => absolute(a.path)).concat(SHELL);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== sw.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			if (ASSETS.includes(url.pathname)) {
				const hit = await cache.match(url.pathname);
				if (hit) return hit;
			}
			try {
				return await fetch(event.request);
			} catch (err) {
				// Offline: page navigations get the app shell, which routes on the client.
				if (event.request.mode === 'navigate') {
					const shell = await cache.match(SHELL);
					if (shell) return new Response(shell.body, { status: 200, headers: shell.headers });
				}
				throw err;
			}
		})()
	);
});
