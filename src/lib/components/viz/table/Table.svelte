<script lang="ts">
	import { cn, debounce } from '$lib/utils/utils';
	import { Table } from './table';
	import { csv } from 'd3';
	import { neighbourhoodSchema } from '$lib/types/data/neighbourhood';
	import { base } from '$app/paths';

	let { class: className = '' } = $props();
	let visContainer: HTMLElement;
	let table: Table | null = null;
	let previousWidth = 0;

	$effect(() => {
		// Wait for the container to be available in the DOM
		if (!visContainer) return;

		const initVis = async () => {
			try {
				const neighbourhoodRawData = await csv(`${base}/data/processed/select-filter.csv`);
				const neighbourhoodData = neighbourhoodRawData.map((row: unknown) =>
					neighbourhoodSchema.parse(row)
				);

				table = new Table(visContainer, neighbourhoodData);
				previousWidth = visContainer.getBoundingClientRect().width;
			} catch (error) {
				console.error('Error loading neighbourhood data:', error);
			}
		};

		initVis();

		// Debounced resize handler
		const handleResize = debounce(() => {
			if (table && visContainer) {
				const containerRect = visContainer.getBoundingClientRect();
				const currentWidth = containerRect.width;

				if (currentWidth !== previousWidth) {
					previousWidth = currentWidth;
					table.resize(currentWidth, containerRect.height);
				}
			}
		}, 250);

		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(visContainer);

		return () => {
			console.log('Cleaning up table...');
			resizeObserver.disconnect();
			if (table) {
				table.destroy();
				table = null;
			}
		};
	});

	// Add effect for filters - similar to how CrimeRate component works
	$effect(() => {
		if (table) {
			table.updateVis();
		}
	});
</script>

<div class={cn('flex w-full flex-col overflow-hidden rounded-lg bg-purple-300', className)}>
	<h2 class="py-0.5 text-center text-xs font-medium">Matching Neighbourhoods</h2>
	<div bind:this={visContainer} class="relative w-full flex-1 overflow-auto bg-white"></div>
</div>
