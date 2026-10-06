import { writable, type Readable } from 'svelte/store';
import type { Player, UserProfile } from '../types/index.ts';
import type { AuthService } from '../ports/index.ts';
import type { UserProfileRepository } from '../ports/index.ts';

export interface AuthState {
	readonly player: Player | null;
	readonly allowedToPlay: boolean;
	readonly isAdmin: boolean;
	readonly loading: boolean;
}

export interface SignUpParams {
	email: string;
	password: string;
	displayName: string;
}

export interface AuthStore extends Readable<AuthState> {
	signInWithGoogle(): Promise<void>;
	signInWithEmail(email: string, password: string): Promise<void>;
	signUpWithEmail(params: SignUpParams): Promise<void>;
	signOut(): Promise<void>;
}

async function ensureProfile(repo: UserProfileRepository, player: Player): Promise<void> {
	const existing = await repo.getById(player.id);
	if (existing) return;
	await repo.create({
		...player,
		email: '',
		allowedToPlay: true,
		isAdmin: false,
		createdAt: Date.now()
	});
}

function buildAuthMethods(authService: AuthService) {
	return {
		async signInWithGoogle() {
			await authService.signInWithGoogle();
		},
		async signInWithEmail(email: string, password: string) {
			await authService.signInWithEmail(email, password);
		},
		async signUpWithEmail(params: SignUpParams) {
			await authService.signUpWithEmail(params);
		},
		async signOut() {
			await authService.signOut();
		}
	};
}

type SetFn = (state: AuthState) => void;
type UpdateFn = (updater: (s: AuthState) => AuthState) => void;

interface PlayerChangeContext {
	set: SetFn;
	update: UpdateFn;
	repo: UserProfileRepository;
	unsubRef: { current: (() => void) | null };
}

function profileToState(player: Player, profile: UserProfile | null): AuthState {
	const allowed = Boolean(profile?.allowedToPlay);
	const admin = Boolean(profile?.isAdmin);
	return { player, allowedToPlay: allowed, isAdmin: admin, loading: false };
}

function watchProfile(player: Player, ctx: PlayerChangeContext): void {
	ctx.unsubRef.current = ctx.repo.onProfileChanged(player.id, (profile) => {
		ctx.set(profileToState(player, profile));
	});
}

function subscribeToProfile(player: Player, ctx: PlayerChangeContext): void {
	ensureProfile(ctx.repo, player)
		.then(() => watchProfile(player, ctx))
		.catch(() => watchProfile(player, ctx));
}

function handlePlayerChange(player: Player | null, ctx: PlayerChangeContext): void {
	if (ctx.unsubRef.current) ctx.unsubRef.current();
	if (!player) {
		ctx.set({ player: null, allowedToPlay: false, isAdmin: false, loading: false });
		return;
	}
	ctx.update((s) => ({ ...s, player, loading: true }));
	subscribeToProfile(player, ctx);
}

export function createAuthStore(
	authService: AuthService,
	profileRepo: UserProfileRepository
): AuthStore {
	const initial: AuthState = { player: null, allowedToPlay: false, isAdmin: false, loading: true };
	const { subscribe, set, update } = writable<AuthState>(initial);
	const ctx: PlayerChangeContext = { set, update, repo: profileRepo, unsubRef: { current: null } };
	authService.onAuthStateChanged((player) => handlePlayerChange(player, ctx));
	return { subscribe, ...buildAuthMethods(authService) };
}
