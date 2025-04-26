<script lang="ts">
	import CrimeRate from '$lib/components/viz/crime-rate/CrimeRate.svelte';
	import Maps from '$lib/components/viz/maps/Maps.svelte';
	import Table from '$lib/components/viz/table/Table.svelte';
	import { selectedMetric as _selectedMetric } from '$lib/stores/map';
	import Filter from '$lib/components/Filter.svelte';
	import Title from '$lib/components/Title.svelte';
	import Languages from '$lib/components/viz/languages/Languages.svelte';
</script>

<svelte:head>
	<title>Toronto Neighbourhoods Lens</title>
	<meta
		name="description"
		content="Are you moving to 🇨🇦 Toronto? Where should you settle down? Explore the neighborhoods with our interactive map and table."
	/>
</svelte:head>

<section>
	<Title />
	<div class="grid w-full grid-cols-1 pt-4 lg:grid-cols-2 lg:grid-rows-2">
		<div
			class="border-grid order-2 flex items-center border-r-0 border-b p-4 lg:order-1 lg:col-span-1 lg:row-span-2 lg:border-r-1"
		>
			<Maps class="h-[560px] w-full" />
		</div>
		<div
			class="border-grid order-1 flex items-center border-b p-4 lg:order-2 lg:col-span-1 lg:row-span-1"
		>
			<Filter />
		</div>
		<div class="border-grid relative order-3 flex h-[296px] items-center border-b p-4 lg:order-3">
			<Table class="h-full w-full" />
		</div>
	</div>
	<div class="grid w-full grid-cols-1 lg:grid-cols-2 lg:grid-rows-1">
		<div class="border-grid col-span-1 flex items-center border-b p-4 lg:border-r lg:border-b-0">
			<CrimeRate class="h-[300px] w-full" />
		</div>
		<div class="flex items-center p-4">
			<Languages class="h-[300px] w-full" />
		</div>
	</div>
</section>
