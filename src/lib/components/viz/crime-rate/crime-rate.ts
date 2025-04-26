import {
	select,
	scaleTime,
	scaleLinear,
	scaleOrdinal,
	line,
	extent,
	max,
	axisBottom,
	axisLeft,
	easeLinear,
	timeFormat,
	type Selection,
	type ScaleTime,
	type ScaleLinear,
	type ScaleOrdinal,
	pointer
} from 'd3';
import { colorSchema } from '$lib/utils/colorSchema';
import type { CrimeData } from '$lib/types/data/crime-rate';
import type { CrimeRateConfig } from '$lib/types/chart/layout';
import merge from 'deepmerge';
import { get } from 'svelte/store';
import { selectedNeighbourhood } from '$lib/stores/map';

const defaultConfig: Required<CrimeRateConfig> = {
	margin: { top: 40, right: 20, bottom: 20, left: 45 },
	tooltip: { padding: 15 },
	legend: { width: 12, height: 12, radius: 5 }
};

export class CrimeRateChart {
	private parentElement: HTMLElement;
	private config: Required<CrimeRateConfig>;
	private width: number;
	private height: number;
	private svg!: Selection<SVGSVGElement, unknown, null, undefined>;
	private chart!: Selection<SVGGElement, unknown, null, undefined>;
	private xScale!: ScaleTime<number, number>;
	private yScale!: ScaleLinear<number, number>;
	private colorScale!: ScaleOrdinal<string, string>;
	private xAxis!: Selection<SVGGElement, unknown, null, undefined>;
	private yAxis!: Selection<SVGGElement, unknown, null, undefined>;
	private data: CrimeData[];
	private neighbourhoods: string[] = [];
	private currentNeighbourhood: string = 'Toronto';
	private dropdown!: Selection<HTMLSelectElement, unknown, null, undefined>;
	private activeCrimeTypes: Set<string> = new Set();

	constructor(
		parentElement: HTMLElement,
		data: CrimeData[],
		config: CrimeRateConfig = defaultConfig
	) {
		this.parentElement = parentElement;
		this.config = merge(defaultConfig, config);
		this.data = data;

		const containerRect = this.parentElement.getBoundingClientRect();
		this.width = containerRect.width - this.config.margin.left - this.config.margin.right;
		this.height = containerRect.height - this.config.margin.top - this.config.margin.bottom;

		const container = select(this.parentElement);
		this.svg = container
			.append('svg')
			.attr('width', containerRect.width)
			.attr('height', containerRect.height);

		this.chart = this.svg
			.append('g')
			.attr('transform', `translate(${this.config.margin.left},${this.config.margin.top})`);

		// Initialize scales
		this.xScale = scaleTime().range([0, this.width]);
		this.yScale = scaleLinear().range([this.height, 0]);
		this.colorScale = scaleOrdinal(colorSchema);

		// Initialize axes with custom tick formatting
		this.xAxis = this.chart.append('g').attr('transform', `translate(0,${this.height})`);
		this.yAxis = this.chart.append('g');

		// Add axis labels
		this.chart
			.append('text')
			.attr('class', 'axis-label text-xs')
			.attr('y', this.height + 35)
			.attr('x', this.width / 2)
			.style('text-anchor', 'middle')
			.text('Year');

		this.chart
			.append('text')
			.attr('class', 'axis-label text-xs')
			.attr('transform', 'rotate(-90)')
			.attr('y', -45)
			.attr('x', -this.height / 2)
			.style('text-anchor', 'middle')
			.text('Crime Rate (per 100,000 population)');

		// Add tooltip div to the chart container
		select(this.parentElement)
			.append('div')
			.attr('id', 'crime-tooltip')
			.style('position', 'absolute')
			.style('opacity', 0)
			.style('background', 'white')
			.style('border', '1px solid #ddd')
			.style('padding', '10px')
			.style('border-radius', '4px')
			.style('pointer-events', 'none')
			.style('font-size', '12px')
			.style('box-shadow', '0 2px 5px rgba(0, 0, 0, 0.1)')
			.style('z-index', '1000')
			.style('transform', 'translate(-50%, -100%)');
	}

	public resize(width: number, height: number): void {
		// Update dimensions
		this.width = width - this.config.margin.left - this.config.margin.right;
		this.height = height - this.config.margin.top - this.config.margin.bottom;

		// Update SVG dimensions
		this.svg.attr('width', width).attr('height', height);

		// Update chart group position
		this.chart.attr('transform', `translate(${this.config.margin.left},${this.config.margin.top})`);

		// Update scales
		this.xScale.range([0, this.width]);
		this.yScale.range([this.height, 0]);

		// Update axes
		this.xAxis.attr('transform', `translate(0,${this.height})`);
		this.yAxis.attr('transform', 'translate(0,0)');

		// Update axis labels
		this.chart
			.select('.axis-label')
			.attr('y', this.height + 35)
			.attr('x', this.width / 2);

		this.chart
			.selectAll('.axis-label')
			.filter((_, i) => i === 1)
			.attr('y', -45)
			.attr('x', -this.height / 2);

		// Update legend position
		this.chart.select('.legend').attr('transform', `translate(${this.width + 10}, 0)`);

		// Update the visualization
		this.updateVis();
	}

	public updateVis(): void {
		// Get the neighborhood from the store
		const neighbourhood = get(selectedNeighbourhood) ?? 'Toronto';

		// Filter data for selected neighbourhood
		const filteredData = this.data.filter((d) => d.neighbourhood === neighbourhood);

		// Group data by crime type
		const crimeTypes = Array.from(new Set(filteredData.map((d) => d.crime_type)));

		// Initialize activeCrimeTypes with all crime types if it's empty (first render only)
		if (this.activeCrimeTypes.size === 0) {
			crimeTypes.forEach((type) => this.activeCrimeTypes.add(type));
		}

		// Clear existing paths and points
		this.chart.selectAll('.line').remove();
		this.chart.selectAll('circle').remove();

		// Filter for active data points
		const activeData = filteredData.filter((d) => this.activeCrimeTypes.has(d.crime_type));

		// Update scales
		// X-scale uses all years in the data
		this.xScale.domain(extent(filteredData, (d) => new Date(d.year, 0)) as [Date, Date]);

		// Y-scale uses only active crime types
		const maxCrimeRate =
			activeData.length > 0 ? (max(activeData, (d) => +d.crime_rate) as number) : 100;
		this.yScale.domain([0, maxCrimeRate * 1.1]);

		this.colorScale.domain(crimeTypes);

		// Create line generator
		const lineGenerator = line<CrimeData>()
			.x((d) => this.xScale(new Date(d.year, 0)))
			.y((d) => this.yScale(+d.crime_rate));

		// Draw lines with points - ONLY for ACTIVE crime types
		crimeTypes.forEach((crimeType) => {
			// Skip inactive crime types
			if (!this.activeCrimeTypes.has(crimeType)) return;

			const crimeData = filteredData.filter((d) => d.crime_type === crimeType);

			// Draw the line with left-to-right animation
			const path = this.chart
				.append('path')
				.datum(crimeData)
				.attr('class', `line line-${crimeType.replace(/\s+/g, '-')}`)
				.attr('d', lineGenerator)
				.style('fill', 'none')
				.style('stroke', this.colorScale(crimeType))
				.style('stroke-width', 2);

			// Get the total length of the path
			const pathLength = path.node()?.getTotalLength() || 0;

			// Set up the animation using stroke-dasharray and stroke-dashoffset
			path
				.attr('stroke-dasharray', pathLength)
				.attr('stroke-dashoffset', pathLength)
				.transition()
				.duration(1500)
				.ease(easeLinear)
				.attr('stroke-dashoffset', 0)
				.on('end', function () {
					select(this).attr('stroke-dasharray', null);
				});

			// Add points with delayed appearance
			this.chart
				.selectAll(null)
				.data(crimeData)
				.enter()
				.append('circle')
				.attr('class', `point-${crimeType.replace(/\s+/g, '-')}`)
				.attr('cx', (d) => this.xScale(new Date(d.year, 0)))
				.attr('cy', (d) => this.yScale(+d.crime_rate))
				.attr('r', 0) // Start with radius 0
				.style('fill', this.colorScale(crimeType))
				.style('stroke', '#fff')
				.style('stroke-width', 1.5)
				.on('mouseover', (event, d) => {
					select(event.currentTarget).attr('r', 7).style('stroke-width', 2);

					const tooltip = select('#crime-tooltip');
					const [mouseX, mouseY] = pointer(event, this.parentElement);

					tooltip
						.style('opacity', 1)
						.html(
							`<div class="tooltip-label">
							<strong>${crimeType}</strong><br>
							Year: ${d.year}<br>
							Crime Rate: ${d.crime_rate.toFixed(1)} per 100,000
						</div>`
						)
						.style('left', `${mouseX}px`)
						.style('top', `${mouseY - 10}px`);
				})
				.on('mousemove', (event) => {
					const [mouseX, mouseY] = pointer(event, this.parentElement);
					select('#crime-tooltip')
						.style('left', `${mouseX}px`)
						.style('top', `${mouseY - 10}px`);
				})
				.on('mouseout', (event) => {
					select(event.currentTarget).attr('r', 5).style('stroke-width', 1.5);

					select('#crime-tooltip').style('opacity', 0);
				});

			// Animate points appearance
			this.chart
				.selectAll(`.point-${crimeType.replace(/\s+/g, '-')}`)
				.transition()
				.delay((d, i) => (i * 1500) / crimeData.length)
				.duration(300)
				.attr('r', 5);
		});

		// Clear existing legend
		this.chart.selectAll('.legend').remove();

		// Add legend with interactivity
		const legend = this.chart
			.append('g')
			.attr('class', 'legend')
			.attr('transform', `translate(${this.width + 10}, 0)`);

		// Function to create a consistent y-axis generator
		const createYAxisGenerator = () => {
			const maxValue = this.yScale.domain()[1];

			// Round up maxValue to nearest 100 or 50
			const roundTo = maxValue > 500 ? 100 : 50;
			const roundedMax = Math.ceil(maxValue / roundTo) * roundTo;

			// Create evenly spaced tick values
			const tickCount = 6;
			const tickStep = roundedMax / (tickCount - 1);
			const tickValues = Array.from({ length: tickCount }, (_, i) => i * tickStep);

			// Update the scale domain to match our rounded max
			this.yScale.domain([0, roundedMax]);

			return axisLeft(this.yScale)
				.tickValues(tickValues)
				.tickFormat((d) => {
					const value = +d;
					if (value >= 1000) {
						return (value / 1000).toFixed(1) + 'k';
					}
					return value.toFixed(0);
				});
		};

		// Create proper x-axis with auto-sizing
		const createXAxisGenerator = () => {
			// Determine appropriate number of ticks based on width
			const yearExtent = extent(filteredData, (d) => d.year) as [number, number];
			const years = yearExtent[1] - yearExtent[0] + 1;

			// Use every year if there are few, otherwise use fewer ticks
			const tickValues = Array.from({ length: years }, (_, i) => yearExtent[0] + i).filter(
				(year) => years <= 10 || year % 2 === 0
			);

			return axisBottom(this.xScale)
				.tickValues(tickValues.map((year) => new Date(year, 0)))
				.tickFormat((d) => timeFormat('%Y')(d as Date));
		};

		// Here's the crucial part for the legend
		crimeTypes.forEach((crimeType, i) => {
			const legendRow = legend
				.append('g')
				.attr('class', 'legend-row')
				.attr('transform', `translate(0, ${i * 20})`)
				.style('cursor', 'pointer')
				// Set initial opacity based on active state
				.style('opacity', this.activeCrimeTypes.has(crimeType) ? 1 : 0.5)
				.on('click', () => {
					// Toggle this crime type's active state
					if (this.activeCrimeTypes.has(crimeType)) {
						// Prevent removing the last active crime type
						if (this.activeCrimeTypes.size > 1) {
							this.activeCrimeTypes.delete(crimeType);
						}
					} else {
						this.activeCrimeTypes.add(crimeType);
					}

					// Update opacity of legend items
					legend.selectAll('.legend-row').style('opacity', (d, j) => {
						const currentCrimeType = crimeTypes[j];
						return this.activeCrimeTypes.has(currentCrimeType) ? 1 : 0.5;
					});

					// Completely redraw chart to reflect active types
					this.updateVis();
				});

			// Add colored circle and label instead of rectangle
			legendRow
				.append('circle')
				.attr('cx', this.config.legend.radius)
				.attr('cy', this.config.legend.radius)
				.attr('r', this.config.legend.radius)
				.style('fill', this.colorScale(crimeType))
				.style('stroke', '#fff')
				.style('stroke-width', 0.5);

			legendRow
				.append('text')
				.attr('x', this.config.legend.radius * 2 + 8)
				.attr('y', this.config.legend.radius + 4)
				.style('font-size', '12px')
				.text(crimeType);
		});

		// Apply axis formatting
		this.yAxis.call(createYAxisGenerator());
		this.xAxis.call(createXAxisGenerator());
	}
}
