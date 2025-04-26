<script lang="ts">
	import { CrimeRateChart } from './crime-rate';
	import * as d3 from 'd3';
	import { cn, debounce } from '$lib/utils/utils';
	import { base } from '$app/paths';
	import { crimeRateSchema } from '$lib/types/data/crime-rate';
	import { selectedNeighbourhood } from '$lib/stores/map';

	let { class: className = '' } = $props();
	let visContainer: HTMLElement;
	let crimeRateChart: CrimeRateChart;
	let previousWidth = 0;

	$effect(() => {
		if (!visContainer) return;

		const initVis = async () => {
			const rawData = await d3.csv(`${base}/data/processed/neighbourhood-crime-rates.csv`);
			const data = rawData.map((row: unknown) => crimeRateSchema.parse(row));

			crimeRateChart = new CrimeRateChart(visContainer, data, {
				margin: {
					top: 20,
					right: 90,
					bottom: 40,
					left: 60
				}
			});

			crimeRateChart.updateVis();

			// Record initial width
			if (visContainer) {
				previousWidth = visContainer.getBoundingClientRect().width;
			}
		};

		initVis();

		// Debounced resize handler
		const handleResize = debounce(() => {
			if (crimeRateChart && visContainer) {
				const containerRect = visContainer.getBoundingClientRect();
				const currentWidth = containerRect.width;

				// Only trigger resize if width has changed
				if (currentWidth !== previousWidth) {
					previousWidth = currentWidth;
					crimeRateChart.resize(currentWidth, containerRect.height);
					crimeRateChart.updateVis();
				}
			}
		}, 250);

		// Use ResizeObserver with debounced handler
		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(visContainer);

		return () => {
			resizeObserver.disconnect();
		};
	});

	$effect(() => {
		const _selectedNeighbourhood = $selectedNeighbourhood;

		if (crimeRateChart) {
			crimeRateChart.updateVis();
		}
	});
</script>

<div class={cn('flex flex-col', className)}>
	<h2 class="text-center text-sm font-semibold">
		Crime Rates in {$selectedNeighbourhood ?? 'Toronto'}
	</h2>
	<div bind:this={visContainer} class="relative flex-1"></div>
</div>
