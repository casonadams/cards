export interface PresenceManager {
	start(): void;
	stop(): void;
}

export function createPresenceManager(
	onPresenceUpdate: (isOnline: boolean) => void
): PresenceManager {
	function handleVisibilityChange(): void {
		onPresenceUpdate(!document.hidden);
	}

	function handleBeforeUnload(): void {
		onPresenceUpdate(false);
	}

	return {
		start(): void {
			onPresenceUpdate(true);
			document.addEventListener('visibilitychange', handleVisibilityChange);
			window.addEventListener('beforeunload', handleBeforeUnload);
		},

		stop(): void {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('beforeunload', handleBeforeUnload);
		}
	};
}
