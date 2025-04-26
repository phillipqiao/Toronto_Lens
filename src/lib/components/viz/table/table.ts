import { select, type Selection } from 'd3';
import type { NeighbourhoodData } from '$lib/types/data/neighbourhood';
import { selectedMetric } from '$lib/stores/map';
import { filterRanges } from '$lib/stores/filter';
import { get } from 'svelte/store';
import { selectedNeighbourhood } from '$lib/stores/map';
import { cn } from '$lib/utils/utils';

export class Table {
	private parentElement: HTMLElement;
	private data: NeighbourhoodData[];
	private filteredData: NeighbourhoodData[];
	private table!: Selection<HTMLTableElement, unknown, null, undefined>;
	private thead!: Selection<HTMLTableSectionElement, unknown, null, undefined>;
	private tbody!: Selection<HTMLTableSectionElement, unknown, null, undefined>;
	private container!: Selection<HTMLElement, unknown, null, undefined>;
	private metricUnsubscribe: () => void;
	private filterUnsubscribe: () => void;
	private neighbourhoodUnsubscribe: () => void;
	private width: number;
	private height: number;
	private config = { margin: { top: 10, right: 5, bottom: 10, left: 5 } };

	constructor(parentElement: HTMLElement, data: NeighbourhoodData[]) {
		this.parentElement = parentElement;
		this.data = data;
		this.filteredData = [];

		const containerRect = this.parentElement.getBoundingClientRect();
		this.width = containerRect.width - this.config.margin.left - this.config.margin.right;
		this.height = containerRect.height - this.config.margin.top - this.config.margin.bottom;
		this.height += 100;

		// Initialize container reference
		this.container = select(this.parentElement);

		// Initialize container and base structure
		this.initVis();

		// Subscribe to store changes
		this.metricUnsubscribe = selectedMetric.subscribe(() => {
			this.updateVis();
		});

		this.filterUnsubscribe = filterRanges.subscribe(() => {
			this.updateVis();
		});

		// Subscribe to neighborhood selection changes
		this.neighbourhoodUnsubscribe = selectedNeighbourhood.subscribe(() => {
			this.updateVis();
		});

		// Initial update
		this.updateVis();
	}

	private initVis(): void {
		// Initialize the container with basic styling
		this.container
			.style('width', '100%')
			.style('height', `${this.height + this.config.margin.top + this.config.margin.bottom}px`)
			.style('overflow-y', 'auto')
			.style('overflow-x', 'auto')
			.style('background-color', 'white')
			.style('position', 'relative')
			.style('border', '1px solid #e2e8f0');

		// Remove any existing content
		this.container.selectAll('*').remove();

		// Create the table with basic styling
		this.table = this.container
			.append('table')
			.style('width', '100%')
			.style('height', '100%')
			.style('table-layout', 'fixed')
			.style('border-collapse', 'separate')
			.style('border-spacing', '0');

		// Create table header - make position fixed
		this.thead = this.table.append('thead').attr('class', 'sticky top-0 z-20 bg-gray-50 shadow-sm');

		// Create table body
		this.tbody = this.table.append('tbody');

		// Add headers
		this.createHeaders();

		console.log('Table initialized:', this.table.node());
	}

	private createHeaders(): void {
		const headers = [
			'Neighbourhood',
			'Population Density',
			'Household Income',
			'Crime Rate',
			'Cultural Diversity'
		];

		// The header row itself doesn't need to be sticky, just the thead element
		const headerRow = this.thead.append('tr').style('height', '50px');

		for (let i = 0; i < headers.length; i++) {
			headerRow
				.append('th')
				.attr(
					'class',
					'text-center max-w-[80px] whitespace-normal break-words text-xs font-semibold border-b border-r border-gray-200 uppercase'
				)
				.text(headers[i]);
		}
	}

	public updateVis(): void {
		const currentFilterRanges = get(filterRanges);

		// Filter data based on all metrics at once
		this.filteredData = this.data.filter((d) => {
			// Check if all metrics are within their filter ranges
			return Object.entries(currentFilterRanges).every(([metricKey, range]) => {
				let value: number;

				// Map the metric key to the corresponding data field
				switch (metricKey) {
					case 'population_density':
						value = d.population_density;
						break;
					case 'household_income':
						value = d['Average after-tax income of households in 2015 ($)'];
						break;
					case 'crime_rate':
						value = d.overall_crime_rate;
						break;
					case 'cultural_diversity':
						value = d.shannon_diversity;
						break;
					default:
						return true;
				}

				return typeof value === 'number' && value >= range.min && value <= range.max;
			});
		});

		console.log(`Filtered data to ${this.filteredData.length} rows based on all metrics`);

		// Clear existing rows
		this.tbody.selectAll('tr').remove();

		// Create rows for each data point
		this.filteredData.forEach((d, index) => {
			const isSelected = d.neighbourhood === get(selectedNeighbourhood);

			const row = this.tbody
				.append('tr')
				.attr(
					'class',
					cn(isSelected ? 'bg-purple-50' : '', index % 2 === 0 ? 'bg-white' : 'bg-purple-50')
				)
				.style('height', '40px')
				.style('transition', 'all 0.2s ease')
				// .style('background-color', isSelected ? '#e0f2fe' : index % 2 === 0 ? 'white' : '#f0faf0')
				.style('cursor', 'pointer')
				.on('click', () => {
					// Update selectedNeighbourhood store when a row is clicked
					selectedNeighbourhood.update((value) => {
						if (value === d.neighbourhood) {
							return null;
						} else {
							return d.neighbourhood;
						}
					});
				})
				.on('mouseover', function () {
					select(this)
						.style('transform', 'translateY(-1px)')
						.style('box-shadow', '0 2px 4px rgba(0,0,0,0.05)');
				})
				.on('mouseout', function () {
					select(this).style('transform', 'translateY(0)').style('box-shadow', 'none');
				});

			// Values for each cell
			const values = [
				d.neighbourhood,
				d.population_density.toFixed(2),
				`$${d['Average after-tax income of households in 2015 ($)'].toLocaleString()}`,
				d.overall_crime_rate.toFixed(2),
				d.shannon_diversity.toFixed(2)
			];

			// Middle cells
			for (let i = 0; i < values.length; i++) {
				row
					.append('td')
					.attr(
						'class',
						cn(
							'max-w-[80px] whitespace-normal break-words border-r border-gray-200 text-xs text-center',
							isSelected ? 'bg-blue-50 text-blue-500' : ''
						)
					)
					.text(values[i]);
			}
		});

		console.log('Table updated with', this.filteredData.length, 'rows');
	}

	public updateData(newData: NeighbourhoodData[]): void {
		this.data = newData;
		this.updateVis();
	}

	public updateFilters(): void {
		this.updateVis();
	}

	public resize(width: number, height: number): void {
		// Update dimensions
		this.width = width - this.config.margin.left - this.config.margin.right;
		this.height = height - this.config.margin.top - this.config.margin.bottom;
		this.height += 100; // Make table higher

		// Update container dimensions
		this.container
			.style('width', '100%')
			.style('height', `${height}px`)
			.style('overflow-y', 'auto')
			.style('overflow-x', 'auto');

		// Update table dimensions
		this.table.attr('width', '100%').style('width', '100%').style('height', '100%');
	}

	public destroy(): void {
		// Clean up subscriptions
		if (this.metricUnsubscribe) this.metricUnsubscribe();
		if (this.filterUnsubscribe) this.filterUnsubscribe();
		if (this.neighbourhoodUnsubscribe) this.neighbourhoodUnsubscribe();

		// Clean up by removing all elements
		if (this.parentElement) {
			select(this.parentElement).selectAll('*').remove();
		}
	}
}
