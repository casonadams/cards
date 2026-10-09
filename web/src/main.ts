// Polyfill crypto.randomUUID for non-secure contexts (e.g. LAN HTTP) and older browsers
if (typeof window !== 'undefined') {
	const g = window as unknown as { crypto?: Crypto };
	if (!g.crypto) {
		g.crypto = {} as Crypto;
	}
	if (typeof g.crypto.randomUUID !== 'function') {
		try {
			Object.defineProperty(g.crypto, 'randomUUID', {
				value: function randomUUID(): string {
					if (typeof g.crypto?.getRandomValues === 'function') {
						const bytes = g.crypto.getRandomValues(new Uint8Array(16));
						bytes[6] = (bytes[6] & 0x0f) | 0x40;
						bytes[8] = (bytes[8] & 0x3f) | 0x80;
						return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
							.join('')
							.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
					}
					return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
						const r = (Math.random() * 16) | 0;
						return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
					});
				},
				writable: true,
				configurable: true
			});
		} catch {
			// Ignore if non-extensible
		}
	}
}

import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;

