import {
	select,
	scaleBand,
	scaleLinear,
	axisBottom,
	axisLeft,
	pointer,
	type Selection,
	type ScaleBand,
	type ScaleLinear
} from 'd3';

import type { LanguageData } from '$lib/types/data/language';
import type { LanguageConfig } from '$lib/types/chart/layout';
import merge from 'deepmerge';
import { get } from 'svelte/store';
import { selectedNeighbourhood } from '$lib/stores/map';

const defaultConfig: Required<LanguageConfig> = {
	margin: { top: 10, right: 20, bottom: 70, left: 60 },
	tooltip: { padding: 15 },
	legend: { width: 5, height: 5, radius: 5 }
};

export class LanguageChart {
	private parentElement: HTMLElement;
	private config: Required<LanguageConfig>;
	private data: LanguageData[];
	private width: number;
	private height: number;
	private svg!: Selection<SVGSVGElement, unknown, null, undefined>;
	private chart!: Selection<SVGGElement, unknown, null, undefined>;
	private xScale!: ScaleBand<string>;
	private yScale!: ScaleLinear<number, number>;
	private tooltip!: Selection<HTMLDivElement, unknown, HTMLElement, HTMLDivElement>;

	constructor(parentElement: HTMLElement, data: LanguageData[], config: LanguageConfig = {}) {
		this.parentElement = parentElement;
		this.config = merge(defaultConfig, config) as Required<LanguageConfig>;
		this.data = data;

		// Initialize with actual container dimensions
		const containerRect = this.parentElement.getBoundingClientRect();
		this.width = containerRect.width - this.config.margin.left - this.config.margin.right;
		this.height = containerRect.height - this.config.margin.top - this.config.margin.bottom;

		// Initialize tooltip attached to container instead of body
		select(this.parentElement)
			.append('div')
			.attr('id', 'language-tooltip')
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

		// Set the tooltip reference for later use
		this.tooltip = select('#language-tooltip') as unknown as Selection<
			HTMLDivElement,
			unknown,
			HTMLElement,
			HTMLDivElement
		>;
	}

	public resize(width: number, height: number): void {
		// Update dimensions
		this.width = width - this.config.margin.left - this.config.margin.right;
		this.height = height - this.config.margin.top - this.config.margin.bottom;

		// Update SVG dimensions
		if (this.svg) {
			this.svg.attr('width', width).attr('height', height);
		}

		// Update chart group position
		if (this.chart) {
			this.chart.attr(
				'transform',
				`translate(${this.config.margin.left},${this.config.margin.top})`
			);
		}

		// Update visualization if elements are initialized
		this.updateVis();
	}

	updateVis() {
		const neighbourhood = get(selectedNeighbourhood);
		let row;
		if (neighbourhood) {
			row = this.data.find((d) => d.neighbourhood === neighbourhood);
		} else {
			const languageKeys = Object.keys(this.data[0]).filter((k) => k !== 'neighbourhood');
			const totalRow: Record<string, number | string> = { neighbourhood: 'Toronto' };
			for (const key of languageKeys) {
				totalRow[key] = this.data.reduce((sum, d) => sum + (d[key] as number), 0);
			}
			row = totalRow;
		}

		if (!row) return;

		// Convert language data
		const entries = Object.entries(row)
			.filter(([key]) => key !== 'neighbourhood')
			.map(([language, value]) => ({ language, value: +value }))
			.sort((a, b) => b.value - a.value)
			.slice(0, 10);

		const { margin } = this.config;

		// clear svg
		select(this.parentElement).selectAll('svg').remove();

		// Create new SVG container
		this.svg = select(this.parentElement)
			.append('svg')
			.attr('width', this.width + margin.left + margin.right)
			.attr('height', this.height + margin.top + margin.bottom);

		this.chart = this.svg
			.append('g')
			.attr('transform', `translate(${margin.left + 20},${margin.top})`);

		// Add y-axis label
		this.chart
			.append('text')
			.attr('class', 'axis-label text-xs')
			.attr('transform', 'rotate(-90)')
			.attr('y', -60)
			.attr('x', -this.height / 2)
			.style('text-anchor', 'middle')
			.text('Population');

		// Add x-axis label
		this.chart
			.append('text')
			.attr('class', 'axis-label text-xs')
			.attr('y', this.height + 55)
			.attr('x', this.width / 2)
			.style('text-anchor', 'middle')
			.text('Language');

		this.xScale = scaleBand()
			.domain(entries.map((d) => d.language))
			.range([0, this.width])
			.padding(0.05);

		this.yScale = scaleLinear()
			.domain([0, Math.max(...entries.map((d) => d.value))])
			.range([this.height, 0]);

		// Bars
		this.chart
			.selectAll('.bar')
			.data(entries)
			.enter()
			.append('rect')
			.attr('class', 'bar')
			.attr('x', (d) => this.xScale(d.language)!)
			.attr('y', (d) => this.yScale(d.value))
			.attr('width', this.xScale.bandwidth())
			.attr('height', (d) => this.height - this.yScale(d.value))
			.attr('fill', '#1664FF')
			.on('mouseover', (event, d) => {
				const tooltip = select('#language-tooltip');
				tooltip.style('opacity', 1).html(`<div class="tooltip-label">
						<strong>${d.language}</strong><br>
						Speakers: ${d.value.toLocaleString()}
					</div>`);

				select(event.currentTarget).attr('fill', '#0A46B4');
			})
			.on('mousemove', (event) => {
				const [mouseX, mouseY] = pointer(event, this.parentElement);
				select('#language-tooltip')
					.style('left', `${mouseX}px`)
					.style('top', `${mouseY - 10}px`);
			})
			.on('mouseout', (event) => {
				select('#language-tooltip').style('opacity', 0);
				select(event.currentTarget).attr('fill', '#1664FF');
			});

		// X Axis
		this.chart
			.append('g')
			.attr('transform', `translate(0,${this.height})`)
			.call(axisBottom(this.xScale))
			.selectAll('text')
			.attr('transform', 'rotate(-20)')
			.style('text-anchor', 'end')
			.style('font-size', '10px');

		// Function to create a consistent y-axis generator - similar to crime-rate
		const createYAxisGenerator = () => {
			const maxValue = this.yScale.domain()[1];

			// Round up maxValue to nearest 1000, 500, 100 based on size
			let roundTo = 1000;
			if (maxValue < 5000) roundTo = 500;
			if (maxValue < 1000) roundTo = 100;

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

		// Y Axis with formatted ticks
		this.chart.append('g').call(createYAxisGenerator());
	}
}
