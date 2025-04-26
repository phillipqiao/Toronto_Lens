<script lang="ts">
	let {
		class: className = '',
		size = 16,
		path
	} = $props<{
		class?: string;
		size?: number;
		path: string;
	}>();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 256 256"
	fill="currentColor"
	class={className}
>
	<path d={path} />
</svg>
