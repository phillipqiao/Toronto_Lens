<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="flex min-h-[100vh] flex-col">
	<main class="mx-auto w-full max-w-7xl px-6 md:px-14">
		{@render children()}
	</main>
</div>

<style>
</style>
