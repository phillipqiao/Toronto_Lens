<script lang="ts">
	import { cn, debounce } from '$lib/utils/utils';
	import { Maps } from './maps';
	import { selectedNeighbourhood, selectedCountry } from '$lib/stores/map';
	import { csv } from 'd3';
	import { immigrationSchema } from '$lib/types/data/immigration';
	import { base } from '$app/paths';
	import { neighbourhoodSchema } from '$lib/types/data/neighbourhood';

	let visContainer: HTMLElement;
	let maps: Maps | null = null;
	let previousWidth = 0;
	let { class: className = '' } = $props();

	$effect(() => {
		const initVis = async () => {
			const immigrationRawData = await csv(`${base}/data/processed/recent-immigration.csv`);
			const immigrationData = immigrationRawData.map((row: unknown) =>
				immigrationSchema.parse(row)
			);

			const neighbourhoodRawData = await csv(`${base}/data/processed/select-filter.csv`);
			const neighbourhoodData = neighbourhoodRawData.map((row: unknown) =>
				neighbourhoodSchema.parse(row)
			);
			maps = new Maps(visContainer, immigrationData, neighbourhoodData);
			maps.updateVis();

			// 初始化时记录当前宽度
			if (visContainer) {
				previousWidth = visContainer.getBoundingClientRect().width;
			}
		};

		initVis();

		// 使用防抖的resize处理函数
		const handleResize = debounce(() => {
			if (maps && visContainer) {
				const containerRect = visContainer.getBoundingClientRect();
				const currentWidth = containerRect.width;

				// 只有当宽度变化时才触发 resize
				if (currentWidth !== previousWidth) {
					previousWidth = currentWidth;
					maps.resize(currentWidth, containerRect.height);
					maps.updateVis();
				}
			}
		}, 250); // 250ms的延迟，可根据需要调整

		// 使用 ResizeObserver 但通过防抖函数控制触发频率
		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(visContainer);

		return () => {
			resizeObserver.disconnect();
		};
	});

	// 监听 selectedNeighbourhood 和 selectedCountry 的变化
	$effect(() => {
		// 访问 store 的值以创建依赖
		const _neighbourhood = $selectedNeighbourhood;
		const _country = $selectedCountry;

		if (maps) {
			maps.updateVis();
		}
	});
</script>

<div class={cn('flex flex-col', className)}>
	<div bind:this={visContainer} class="relative flex-1"></div>
</div>
