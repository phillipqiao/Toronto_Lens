<script lang="ts">
	import { Slider, Select, Tooltip } from 'bits-ui';
	import {
		filterRanges,
		type FilterRanges,
		fallBackFilterRange,
		rangeSteps
	} from '$lib/stores/filter';
	import { selectedMetric } from '$lib/stores/map';
	import Icon from '$lib/icons/Icon.svelte';
	import { base } from '$app/paths';
	import { csv } from 'd3';
	import { neighbourhoodSchema } from '$lib/types/data/neighbourhood';
	import { onMount } from 'svelte';
	import { Search } from '@lucide/svelte';

	// svelte-ignore non_reactive_update
	let dataRanges = fallBackFilterRange;
	let currentSliderValues = $state(fallBackFilterRange);

	function getSliderValues(metric: keyof FilterRanges): () => [number, number] {
		return function () {
			return [currentSliderValues[metric].min, currentSliderValues[metric].max];
		};
	}

	function setSliderValues(metric: keyof FilterRanges): (values: [number, number]) => void {
		return function (values: [number, number]) {
			currentSliderValues[metric] = { min: values[0], max: values[1] };
		};
	}

	onMount(() => {
		const loadData = async () => {
			const neighbourhoodRawData = await csv(`${base}/data/processed/select-filter.csv`);
			const neighbourhoodData = neighbourhoodRawData.map((row: unknown) =>
				neighbourhoodSchema.parse(row)
			);

			const ranges = neighbourhoodData.reduce((acc, d) => {
				const metrics: Record<keyof FilterRanges, number> = {
					population_density: d.population_density,
					household_income: d['Average after-tax income of households in 2015 ($)'],
					crime_rate: d.overall_crime_rate,
					cultural_diversity: d.shannon_diversity
				};

				Object.entries(metrics).forEach(([key, value]) => {
					const typedKey = key as keyof FilterRanges;

					if (!acc[typedKey]) {
						acc[typedKey] = {
							min: Math.floor(value / rangeSteps[typedKey]) * rangeSteps[typedKey],
							max: Math.ceil(value / rangeSteps[typedKey]) * rangeSteps[typedKey]
						};
					} else {
						acc[typedKey].min =
							Math.floor(Math.min(acc[typedKey].min, Math.floor(value)) / rangeSteps[typedKey]) *
							rangeSteps[typedKey];
						acc[typedKey].max =
							Math.ceil(Math.max(acc[typedKey].max, Math.ceil(value)) / rangeSteps[typedKey]) *
							rangeSteps[typedKey];
					}
				});

				return acc;
			}, {} as FilterRanges);

			$filterRanges = ranges;
			dataRanges = ranges;
			currentSliderValues = ranges;
		};

		loadData();
	});

	const ICONS = {
		caretDown:
			'M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z',
		check:
			'M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z',
		info: 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z'
	};

	const metricDisplayNames: Record<keyof FilterRanges, string> = {
		population_density: 'Population density',
		household_income: 'Household income',
		crime_rate: 'Overall crime rate',
		cultural_diversity: 'Cultural diversity index'
	};

	const metricDescriptions: Record<keyof FilterRanges, string> = {
		population_density: 'Number of population per square kilometer',
		household_income: 'Average after-tax income of households per year',
		crime_rate: 'Rate of reported crimes per 100,000 population',
		cultural_diversity:
			'Shannon entropy index measuring cultural diversity (higher means more diverse)'
	};

	const metrics = Object.entries(metricDisplayNames).map(([value, label]) => ({
		value,
		label
	}));

	const formatValue = (metric: keyof FilterRanges, value: number) => {
		switch (metric) {
			case 'household_income':
				return `$${value.toLocaleString()}`;
			case 'population_density':
				return `${value.toLocaleString()}/km²`;
			case 'crime_rate':
				return value.toLocaleString();
			case 'cultural_diversity':
				return value.toFixed(2);
			default:
				return value.toString();
		}
	};

	const handleValueCommit = (metric: keyof FilterRanges) => {
		return (value: number[]) => {
			if (value.length === 2) {
				// Update filterRanges directly
				filterRanges.update((ranges) => {
					const newRanges = { ...ranges };
					newRanges[metric] = { min: value[0], max: value[1] };
					return newRanges;
				});
			}
		};
	};

	const handleReset = () => {
		// Reset all values to initial ranges
		$filterRanges = dataRanges;
		currentSliderValues = dataRanges;
	};
</script>

<div class="mx-auto flex flex-col gap-4 rounded-lg px-2 pb-2">
	<div class="flex items-center justify-between">
		<Select.Root
			type="single"
			value={$selectedMetric}
			onValueChange={(v) => ($selectedMetric = v)}
			items={metrics}
		>
			<Select.Trigger
				class="h-input inline-flex w-54 items-center rounded-md border border-purple-200 bg-white px-2 py-1.5 text-sm font-medium text-gray-700 transition-colors select-none hover:border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:outline-none data-placeholder:text-gray-500"
				aria-label="Select a metric"
			>
				<Search size={16} class="mr-2 text-purple-500" />
				<span class="font-sm text-sm">
					{$selectedMetric
						? metricDisplayNames[$selectedMetric as keyof FilterRanges]
						: 'Select a metric'}
				</span>
				<Icon path={ICONS.caretDown} class="ml-auto text-purple-500" size={16} />
			</Select.Trigger>
			<Select.Portal>
				<Select.Content
					class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-[var(--bits-select-content-available-height)] w-54 min-w-[var(--bits-select-trigger-width)] rounded-md border border-purple-100 bg-white p-1 shadow-lg select-none"
					sideOffset={5}
				>
					<Select.Viewport class="p-1">
						{#each metrics as metric}
							<Select.Item
								class="flex h-9 w-full items-center rounded-md px-4 py-2 text-sm text-gray-700 outline-hidden select-none data-highlighted:bg-purple-50 data-highlighted:text-purple-900"
								value={metric.value}
								label={metric.label}
							>
								{#snippet children({ selected })}
									{#if selected}
										<div class="mr-2">
											<Icon path={ICONS.check} class="text-purple-500" size={16} />
										</div>
									{/if}
									{metric.label}
								{/snippet}
							</Select.Item>
						{/each}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
		<button
			class="rounded-md bg-purple-100 px-2.5 py-1 text-purple-700 hover:bg-purple-200 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:outline-none"
			onclick={handleReset}
		>
			<span class="text-sm">Reset</span>
		</button>
	</div>
	{#each Object.entries($filterRanges) as [metric, range]}
		{@const key = metric as keyof FilterRanges}
		<div class="flex flex-col gap-2">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-1">
					<span class="text-sm font-medium">{metricDisplayNames[key]}</span>
					<Tooltip.Provider>
						<Tooltip.Root delayDuration={200}>
							<Tooltip.Trigger class="inline-flex items-center justify-center text-purple-500">
								<Icon path={ICONS.info} size={16} />
							</Tooltip.Trigger>
							<Tooltip.Content sideOffset={5} class="z-50 max-w-[300px]">
								<div
									class="rounded-md border border-purple-100 bg-white p-2 text-xs text-gray-700 shadow-md"
								>
									{metricDescriptions[key]}
								</div>
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				</div>
				<span class="text-sm text-gray-500">
					{formatValue(key, range.min)} - {formatValue(key, range.max)}
				</span>
			</div>
			<Slider.Root
				type="multiple"
				min={dataRanges[key].min}
				max={dataRanges[key].max}
				step={rangeSteps[key]}
				bind:value={getSliderValues(key), setSliderValues(key)}
				onValueCommit={handleValueCommit(key)}
				class="relative flex w-76 touch-none items-center select-none"
			>
				{#snippet children({ thumbs })}
					<span
						class="relative h-1.5 w-full grow cursor-pointer overflow-hidden rounded-full bg-purple-100"
					>
						<Slider.Range class="absolute h-full bg-purple-500" />
					</span>
					{#each thumbs as index}
						<Slider.Thumb
							{index}
							class="group relative block h-4 w-4 cursor-pointer rounded-full border border-purple-500 bg-white shadow-sm transition-colors hover:border-purple-600 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
						>
							<div
								class="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
							>
								{formatValue(
									key,
									index === 0 ? currentSliderValues[key].min : currentSliderValues[key].max
								)}
							</div>
						</Slider.Thumb>
					{/each}
				{/snippet}
			</Slider.Root>
		</div>
	{/each}
</div>
