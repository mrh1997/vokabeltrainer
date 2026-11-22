/** Reactive online/offline state shared by all pages. */
export const connection = $state({ online: typeof navigator === 'undefined' ? true : navigator.onLine });

if (typeof window !== 'undefined') {
	addEventListener('online', () => (connection.online = true));
	addEventListener('offline', () => (connection.online = false));
}
