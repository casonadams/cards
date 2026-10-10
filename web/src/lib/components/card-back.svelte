<script lang="ts">
	import { CARD_BACK_WAVES, X_STEPS, Y_STEPS } from './card-back-paths';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	// Unique ID per component instance to avoid SVG defs collision
	const uid = Math.random().toString(36).slice(2, 8);
	const plaidId = `cb-plaid-${uid}`;
	const ringId = `cb-ring-${uid}`;
	const cornerRingId = `cb-cring-${uid}`;
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 160 232"
	class="w-full h-full block select-none pointer-events-none {className}"
	preserveAspectRatio="none"
	aria-hidden="true"
>
	<defs>
		<!-- Scottish Diamond Tartan Crosshatch Pattern (rotated 45deg) -->
		<pattern
			id={plaidId}
			width="12"
			height="12"
			patternUnits="userSpaceOnUse"
			patternTransform="rotate(45)"
		>
			<rect width="12" height="12" fill="#ffffff" />

			<!-- Primary Thick Grid Lines -->
			<line x1="0" y1="0" x2="0" y2="12" stroke="#065f46" stroke-width="1.5" />
			<line x1="12" y1="0" x2="12" y2="12" stroke="#065f46" stroke-width="1.5" />
			<line x1="0" y1="0" x2="12" y2="0" stroke="#065f46" stroke-width="1.5" />
			<line x1="0" y1="12" x2="12" y2="12" stroke="#065f46" stroke-width="1.5" />

			<!-- Secondary Thin Framing Lines (forming double-band) -->
			<line x1="1.8" y1="0" x2="1.8" y2="12" stroke="#065f46" stroke-width="0.55" />
			<line x1="10.2" y1="0" x2="10.2" y2="12" stroke="#065f46" stroke-width="0.55" />
			<line x1="0" y1="1.8" x2="12" y2="1.8" stroke="#065f46" stroke-width="0.55" />
			<line x1="0" y1="10.2" x2="12" y2="10.2" stroke="#065f46" stroke-width="0.55" />
		</pattern>

		<!-- Reusable Eyelet Ring Symbol -->
		<g id={ringId}>
			<circle cx="0" cy="0" r="2.7" fill="none" stroke="#065f46" stroke-width="0.75" />
			<circle cx="0" cy="0" r="1.6" fill="none" stroke="#065f46" stroke-width="0.5" />
			<circle cx="0" cy="0" r="0.75" fill="#065f46" />
		</g>

		<!-- Corner Rosette Ring Symbol -->
		<g id={cornerRingId}>
			<circle cx="0" cy="0" r="3.1" fill="none" stroke="#065f46" stroke-width="0.8" />
			<circle cx="0" cy="0" r="1.8" fill="none" stroke="#065f46" stroke-width="0.55" />
			<circle cx="0" cy="0" r="0.8" fill="#065f46" />
		</g>
	</defs>

	<!-- Card White Base -->
	<rect width="160" height="232" rx="10" fill="#ffffff" />

	<!-- Outer Double Borders -->
	<rect x="4.5" y="4.5" width="151" height="223" rx="8" fill="none" stroke="#065f46" stroke-width="1.3" />
	<rect x="7" y="7" width="146" height="218" rx="6" fill="none" stroke="#065f46" stroke-width="0.7" />

	<!-- Ribbon Channel Guide Lines -->
	<rect x="9.5" y="9.5" width="141" height="213" rx="4.5" fill="none" stroke="#065f46" stroke-width="0.6" />
	<rect x="20.5" y="20.5" width="119" height="191" rx="2" fill="none" stroke="#065f46" stroke-width="0.6" />

	<!-- Ribbon Corner Diagonal Links -->
	<line x1="11.5" y1="11.5" x2="18.5" y2="18.5" stroke="#065f46" stroke-width="0.75" />
	<line x1="148.5" y1="11.5" x2="141.5" y2="18.5" stroke="#065f46" stroke-width="0.75" />
	<line x1="11.5" y1="220.5" x2="18.5" y2="213.5" stroke="#065f46" stroke-width="0.75" />
	<line x1="148.5" y1="220.5" x2="141.5" y2="213.5" stroke="#065f46" stroke-width="0.75" />

	<!-- Ribbon Braided Waves -->
	{#each CARD_BACK_WAVES as d}
		<path {d} fill="none" stroke="#065f46" stroke-width="0.7" />
	{/each}

	<!-- Corner Eyelets -->
	<use href="#{cornerRingId}" x="15" y="15" />
	<use href="#{cornerRingId}" x="145" y="15" />
	<use href="#{cornerRingId}" x="15" y="217" />
	<use href="#{cornerRingId}" x="145" y="217" />

	<!-- Top & Bottom Eyelet Rings -->
	{#each X_STEPS as x}
		<use href="#{ringId}" {x} y="15" />
		<use href="#{ringId}" {x} y="217" />
	{/each}

	<!-- Left & Right Eyelet Rings -->
	{#each Y_STEPS as y}
		<use href="#{ringId}" x="15" {y} />
		<use href="#{ringId}" x="145" {y} />
	{/each}

	<!-- Inner Double Borders -->
	<rect x="21.75" y="21.75" width="116.5" height="188.5" rx="1.5" fill="none" stroke="#065f46" stroke-width="0.6" />
	<rect x="23.5" y="23.5" width="113" height="185" rx="1" fill="none" stroke="#065f46" stroke-width="1.4" />

	<!-- Central Field Plaid Pattern -->
	<rect x="24.2" y="24.2" width="111.6" height="183.6" fill="url(#{plaidId})" />
</svg>
