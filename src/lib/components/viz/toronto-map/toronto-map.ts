import { selectedCountry, selectedNeighbourhood, selectedMetric } from '$lib/stores/map';
import { filterRanges, type FilterRanges } from '$lib/stores/filter';
import {
	geoMercator,
	geoPath,
	interpolateHcl,
	scaleLinear,
	select,
	type GeoPath,
	type GeoProjection,
	type Selection
} from 'd3';
import merge from 'deepmerge';
import type { FeatureCollection, GeoJsonProperties } from 'geojson';
import type { Feature } from 'geojson';
import type { Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { get } from 'svelte/store';
import {
	colorSchema,
	sequentialColorSchema,
	purpleSequentialColorSchema,
	cyanSequentialColorSchema,
	greenSequentialColorSchema,
	yellowSequentialColorSchema
} from '$lib/utils/colorSchema';
import type { TorontoMapConfig } from '$lib/types/chart/layout';
import { findOptimalCenterPoint } from '$lib/utils/map';
import type { NeighbourhoodData } from '$lib/types/data/neighbourhood';
import { base } from '$app/paths';

const defaultConfig: Required<TorontoMapConfig> = {
	projectionFunc: geoMercator,
	margin: { top: 10, right: 10, bottom: 10, left: 10 },
	tooltip: {
		padding: 10
	},
	centerPoint: {
		precision: 0.0000001,
		show: false,
		radius: 3,
		color: '#523'
	}
};

// 定义简化的 TopoJSON 类型
interface TopoData extends Topology {
	objects: {
		[key: string]: GeometryCollection;
	};
}

type GeoFeature = Feature<Geometry, GeoJsonProperties>;

export class TorontoMap {
	private config: Required<TorontoMapConfig>;
	private parentElement: HTMLElement;
	private data: Map<string, NeighbourhoodData>;
	private width: number;
	private height: number;
	private svg: Selection<SVGSVGElement, unknown, null, undefined>;
	private mapG: Selection<SVGGElement, unknown, null, undefined>;
	private titleText: Selection<SVGTextElement, unknown, null, undefined>;
	private projection: GeoProjection;
	private path: GeoPath;
	private topoData: TopoData | null = null;
	private geoData: FeatureCollection | null = null;
	private centerPoints: Map<string, [number, number]> = new Map();
	private colorScale: d3.ScaleLinear<string, string> = scaleLinear<string, string>();
	private metricUnsubscribe: () => void;
	private filterUnsubscribe: () => void;
	private legendGroup: Selection<SVGGElement, unknown, null, undefined> | null = null;
	private legendRect: Selection<SVGRectElement, unknown, null, undefined> | null = null;
	private legendTitle: Selection<SVGTextElement, unknown, null, undefined> | null = null;
	private linearGradient: Selection<SVGLinearGradientElement, unknown, null, undefined> | null =
		null;

	private readonly metricMapping: Record<string, keyof NeighbourhoodData> = {
		population_density: 'population_density',
		household_income: 'Average after-tax income of households in 2015 ($)',
		crime_rate: 'overall_crime_rate',
		cultural_diversity: 'shannon_diversity'
	};

	private readonly metricDisplayNames: Record<string, string> = {
		population_density: 'Population Density (per km²)',
		household_income: 'Household Income ($)',
		crime_rate: 'Crime Rate (per 100,000)',
		cultural_diversity: 'Cultural Diversity Index'
	};

	private readonly metricColorSchemas: Record<string, typeof sequentialColorSchema> = {
		population_density: greenSequentialColorSchema,
		household_income: yellowSequentialColorSchema,
		crime_rate: purpleSequentialColorSchema,
		cultural_diversity: cyanSequentialColorSchema
	};

	constructor(
		parentElement: HTMLElement,
		data: NeighbourhoodData[],
		config: TorontoMapConfig = defaultConfig
	) {
		this.config = merge(defaultConfig, config);
		this.parentElement = parentElement;
		this.data = new Map(data.map((d) => [d.neighbourhood, d]));

		const containerRect = this.parentElement.getBoundingClientRect();
		this.width = containerRect.width - this.config.margin.left - this.config.margin.right;
		this.height = containerRect.height - this.config.margin.top - this.config.margin.bottom;

		const container = select(this.parentElement);
		this.svg = container
			.append('svg')
			.attr('width', containerRect.width)
			.attr('height', containerRect.height);

		// Add title to the top of the map
		this.titleText = this.svg
			.append('text')
			.attr('class', 'text-sm font-semibold text-gray-600')
			.attr('x', containerRect.width / 2)
			.attr('y', this.config.margin.top + 12)
			.attr('text-anchor', 'middle')
			.text('City of Toronto');

		this.mapG = this.svg
			.append('g')
			.attr('transform', `translate(${this.config.margin.left},${this.config.margin.top})`);

		this.projection = this.config.projectionFunc();
		this.path = geoPath().projection(this.projection);

		// Initialize color scale with default schema
		this.colorScale = scaleLinear<string>()
			.range([sequentialColorSchema[100], sequentialColorSchema[600]])
			.interpolate(interpolateHcl);

		// Initialize legend
		this.initializeLegend();

		// Subscribe to metric changes
		this.metricUnsubscribe = selectedMetric.subscribe(() => {
			this.updateVis();
		});

		// Subscribe to filter changes
		this.filterUnsubscribe = filterRanges.subscribe(() => {
			this.updateVis();
		});
	}

	async loadMap(): Promise<boolean> {
		try {
			const response = await fetch(`${base}/data/original/neighbourhoods.json`);
			this.topoData = await response.json();

			if (this.projection && this.topoData) {
				const objectKey = Object.keys(this.topoData.objects)[0];
				this.geoData = feature(this.topoData, this.topoData.objects[objectKey]);
				if (this.geoData) {
					this.projection.fitSize([this.width, this.height], this.geoData);
					this.geoData.features.forEach((d) => {
						this.centerPoints.set(
							d.properties?.neighbourhood ?? '',
							findOptimalCenterPoint(d, this.config.centerPoint.precision)
						);
					});
				}
			}

			return !!this.geoData;
		} catch (error) {
			console.error('Load TopoJSON map data error:', error);
			return false;
		}
	}

	public resize(width: number, height: number) {
		this.width = width - this.config.margin.left - this.config.margin.right;
		this.height = height - this.config.margin.top - this.config.margin.bottom;

		this.svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

		// Update title position on resize
		this.titleText.attr('x', width / 2);

		// Update legend position on resize
		if (this.legendGroup) {
			this.legendGroup.attr('transform', `translate(${this.width - 160}, ${this.height - 40})`);
		}

		this.updateVis();
	}

	public async updateVis() {
		await this.loadMap();

		const metric = get(selectedMetric);
		const dataField = this.metricMapping[metric];
		const values = Array.from(this.data.values())
			.map((d) => d[dataField])
			.filter((v): v is number => typeof v === 'number');
		const maxValue = Math.max(...values);
		const minValue = Math.min(...values);

		// Get the appropriate color schema for the current metric
		const currentColorSchema = this.metricColorSchemas[metric];

		// Update color scale with the current metric's color schema
		this.colorScale
			.range([currentColorSchema[100], currentColorSchema[600]])
			.domain([minValue, maxValue]);

		this.updateLegend();
		this.renderVis();
	}

	private renderVis() {
		if (!this.topoData || !this.geoData) return;

		const metric = get(selectedMetric) as keyof FilterRanges;
		const dataField = this.metricMapping[metric];
		const currentFilterRanges = get(filterRanges);

		const sortedFeatures = [...this.geoData.features].sort((a, b) => {
			const aIsSelected = a.properties?.neighbourhood === get(selectedNeighbourhood);
			const bIsSelected = b.properties?.neighbourhood === get(selectedNeighbourhood);
			return aIsSelected ? 1 : bIsSelected ? -1 : 0;
		});

		const tooltip = select(this.parentElement)
			.selectAll('.tooltip')
			.data([null])
			.join('div')
			.attr(
				'class',
				'tooltip absolute p-2 z-50 bg-white border border-gray-200 text-xs pointer-events-none opacity-0 shadow-sm'
			);

		this.mapG
			.selectAll<SVGPathElement, GeoFeature>('.neighbourhood')
			.data(sortedFeatures)
			.join('path')
			.attr('class', 'neighbourhood')
			.attr('d', (d) => this.path(d))
			.attr('fill', (d) => {
				const neighbourhood = d.properties?.neighbourhood;
				if (!neighbourhood) return '#ccc';

				const data = this.data.get(neighbourhood);
				if (!data) return '#ccc';

				// Check if all metrics are within their filter ranges
				const meetsAllFilters = Object.entries(currentFilterRanges).every(([metricKey, range]) => {
					const value = data[this.metricMapping[metricKey as keyof FilterRanges]];
					return typeof value === 'number' && value >= range.min && value <= range.max;
				});

				if (!meetsAllFilters) return '#ccc';

				const value = data[dataField];
				return typeof value === 'number' ? this.colorScale(value) : '#ccc';
			})
			.attr('stroke', (d) => {
				return d.properties?.neighbourhood === get(selectedNeighbourhood) ? colorSchema[2] : '#fff';
			})
			.attr('stroke-width', 0.5)
			.attr('opacity', (d) => {
				const neighbourhood = d.properties?.neighbourhood;
				if (!neighbourhood) return 0.5;

				const data = this.data.get(neighbourhood);
				if (!data) return 0.5;

				// Check if all metrics are within their filter ranges
				const meetsAllFilters = Object.entries(currentFilterRanges).every(([metricKey, range]) => {
					const value = data[this.metricMapping[metricKey as keyof FilterRanges]];
					return typeof value === 'number' && value >= range.min && value <= range.max;
				});

				return meetsAllFilters ? 1 : 0.5;
			})
			.on('mousedown', (_event, d) => {
				const name = d.properties?.neighbourhood;
				if (!name) return;

				selectedNeighbourhood.update((value) => {
					if (value === name) {
						return null;
					} else {
						selectedCountry.set(null);
						return name;
					}
				});
			})
			.on('mouseover', (event, d) => {
				const neighbourhoodName = d.properties?.neighbourhood;
				const value = this.data.get(neighbourhoodName)?.[dataField];
				const displayName = metric
					.split('_')
					.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
					.join(' ');

				// Don't use event.layerX and event.layerY, because they may have different behavior on different browsers
				const layerX = event.clientX - this.parentElement.getBoundingClientRect().left;
				const layerY = event.clientY - this.parentElement.getBoundingClientRect().top;

				tooltip
					.style('opacity', 1)
					.html(
						`${neighbourhoodName}<br><strong>${displayName}:</strong> ${typeof value === 'number' ? value.toFixed(2) : 'N/A'}`
					)
					.style('left', layerX + this.config.tooltip.padding + 'px')
					.style('top', layerY + this.config.tooltip.padding + 'px');
			})
			.on('mousemove', (event) => {
				// Don't use event.layerX and event.layerY, because they may have different behavior on different browsers
				const layerX = event.clientX - this.parentElement.getBoundingClientRect().left;
				const layerY = event.clientY - this.parentElement.getBoundingClientRect().top;

				tooltip
					.style('display', 'block')
					.style('left', layerX + this.config.tooltip.padding + 'px')
					.style('top', layerY + this.config.tooltip.padding + 'px');
			})
			.on('mouseleave', () => {
				tooltip.style('display', 'none').style('opacity', 0);
			});

		this.mapG
			.selectAll<SVGCircleElement, GeoFeature>('.neighourhood-center')
			.data(this.config.centerPoint.show ? this.geoData.features : [])
			.join('circle')
			.attr('class', 'neighourhood-center')
			.attr('r', this.config.centerPoint.radius)
			.attr('fill', this.config.centerPoint.color)
			.attr('transform', (d) => {
				const centerPoint = findOptimalCenterPoint(d, this.config.centerPoint.precision);
				const projectedPoint = this.projection(centerPoint);
				return projectedPoint ? `translate(${projectedPoint[0]},${projectedPoint[1]})` : '';
			});
	}

	public getCenterPosition(name: string): [number, number] | null {
		if (name === 'City of Toronto') {
			return [this.width / 2, this.height * 0.95];
		}
		const centerPoint = this.centerPoints.get(name);
		if (!centerPoint) return null;
		const projectedPoint = this.projection(centerPoint);
		return projectedPoint
			? [projectedPoint[0] + this.config.margin.left, projectedPoint[1] + this.config.margin.top]
			: null;
	}

	private initializeLegend() {
		// Initialize gradient for legend
		this.linearGradient = this.svg
			.append('defs')
			.append('linearGradient')
			.attr('id', 'legend-gradient')
			.attr('x1', '0%')
			.attr('y1', '0%')
			.attr('x2', '100%')
			.attr('y2', '0%');

		// Create legend group
		this.legendGroup = this.svg
			.append('g')
			.attr('class', 'legend-group')
			.attr('transform', `translate(${this.width - 180}, ${this.height - 40})`);

		// Append legend title
		this.legendTitle = this.legendGroup
			.append('text')
			.attr('class', 'legend-title semibold')
			.attr('y', -5)
			.attr('x', 0)
			.style('font-size', '12px');

		// Append legend rect
		this.legendRect = this.legendGroup
			.append('rect')
			.attr('width', 120)
			.attr('height', 10)
			.style('stroke', '#ccc')
			.style('stroke-width', '0.5px');

		// Add min and max labels
		this.legendGroup
			.append('text')
			.attr('class', 'min-value')
			.attr('x', 15)
			.attr('y', 20)
			.style('font-size', '10px')
			.style('text-anchor', 'end');

		this.legendGroup
			.append('text')
			.attr('class', 'max-value')
			.attr('x', 100)
			.attr('y', 20)
			.style('font-size', '10px')
			.style('text-anchor', 'start');
	}

	private updateLegend() {
		if (!this.legendGroup || !this.legendRect || !this.legendTitle || !this.linearGradient) return;

		const metric = get(selectedMetric);
		const dataField = this.metricMapping[metric];
		const values = Array.from(this.data.values())
			.map((d) => d[dataField])
			.filter((v): v is number => typeof v === 'number');
		const maxValue = Math.max(...values);
		const minValue = Math.min(...values);

		// Get the appropriate color schema for the current metric
		const currentColorSchema = this.metricColorSchemas[metric];

		// Update gradient stops
		this.linearGradient.selectAll('stop').remove();
		this.linearGradient
			.append('stop')
			.attr('offset', '0%')
			.attr('stop-color', currentColorSchema[100]);
		this.linearGradient
			.append('stop')
			.attr('offset', '100%')
			.attr('stop-color', currentColorSchema[600]);

		// Update legend rect fill
		this.legendRect.attr('fill', 'url(#legend-gradient)');

		// Update legend title
		this.legendTitle.text(this.metricDisplayNames[metric]);

		// Update min and max values
		this.legendGroup.select('.min-value').text(minValue.toFixed(1));
		this.legendGroup.select('.max-value').text(maxValue.toFixed(1));
	}
}
