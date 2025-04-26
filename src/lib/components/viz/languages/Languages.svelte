<script lang="ts">
	import { LanguageChart } from './language';
	import * as d3 from 'd3';
	import { cn, debounce } from '$lib/utils/utils';
	import { base } from '$app/paths';
	import { languageSchema, type LanguageData } from '$lib/types/data/language';
	import { selectedNeighbourhood } from '$lib/stores/map';

	let { class: className = '' } = $props();
	let visContainer: HTMLElement;
	let languageChart: LanguageChart;
	let rawData: LanguageData[] = [];
	let previousWidth = 0;

	$effect(() => {
		if (!visContainer) return;

		const initVis = async () => {
			const csvRaw = await d3.csv(`${base}/data/processed/filtered_languages.csv`);
			rawData = csvRaw.map((row) => {
				const converted: Record<string, string | number> = { ...row };
				for (const key in converted) {
					if (key !== 'neighbourhood') {
						converted[key] = Number(converted[key]) || 0;
					}
				}
				return languageSchema.parse(converted);
			});

			languageChart = new LanguageChart(visContainer, rawData, {
				margin: {
					top: 20,
					right: 20,
					bottom: 60,
					left: 50
				}
			});

			languageChart.updateVis();

			// Record initial width
			previousWidth = visContainer.getBoundingClientRect().width;
		};

		initVis();

		// Debounced resize handler
		const handleResize = debounce(() => {
			if (languageChart && visContainer) {
				const containerRect = visContainer.getBoundingClientRect();
				const currentWidth = containerRect.width;

				// Only trigger resize if width has changed
				if (currentWidth !== previousWidth) {
					previousWidth = currentWidth;
					languageChart.resize(currentWidth, containerRect.height);
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
		const _ = $selectedNeighbourhood;
		if (languageChart) {
			languageChart.updateVis();
		}
	});
</script>

<div class={cn('flex flex-col', className)}>
	<h2 class="text-center text-sm font-semibold">
		Top Languages in {$selectedNeighbourhood ?? 'Toronto'}
	</h2>
	<div bind:this={visContainer} class="relative flex-1"></div>
</div>
