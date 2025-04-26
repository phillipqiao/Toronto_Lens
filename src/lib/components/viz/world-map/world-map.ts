import { feature } from 'topojson-client';
import merge from 'deepmerge';
import {
	type GeoProjection,
	type GeoPath,
	type Selection,
	geoNaturalEarth1,
	select,
	geoPath,
	scaleLinear,
	extent,
	interpolateRgb,
	type ScaleLinear
} from 'd3';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import { selectedNeighbourhood } from '$lib/stores/map';
import { selectedCountry } from '$lib/stores/map';
import type { WorldMapConfig } from '$lib/types/chart/layout';
import { colorSchema, sequentialColorSchema } from '$lib/utils/colorSchema';
import { get } from 'svelte/store';
import type { ImmigrationData } from '$lib/types/data/immigration';
import type { GeoFeature } from '$lib/types/chart/map';
import { findOptimalCenterPoint } from '$lib/utils/map';
import { base } from '$app/paths';

// 定义简化的 TopoJSON 类型
interface TopoData extends Topology {
	objects: {
		[key: string]: GeometryCollection;
	};
}

const defaultConfig: Required<WorldMapConfig> = {
	margin: { top: 10, right: 10, bottom: 10, left: 10 },
	projectionFunc: geoNaturalEarth1,
	centerPoint: {
		precision: 1,
		show: false,
		radius: 3,
		color: '#523'
	},
	tooltip: {
		padding: 10
	}
};

export class WorldMap {
	private parentElement: HTMLElement;
	private data: ImmigrationData[];
	private config: Required<WorldMapConfig>;
	private width: number = 0;
	private height: number = 0;
	private topoData: TopoData | null = null;
	private geoData: FeatureCollection | null = null; // 转换后的 GeoJSON
	private centerPoints: Map<string, [number, number]> = new Map();
	private svg: Selection<SVGSVGElement, unknown, null, undefined>;
	private mapG: Selection<SVGGElement, unknown, null, undefined>;
	private projection: GeoProjection;
	private path: GeoPath;
	private filteredData: ImmigrationData[] = [];
	private countryCountMap: Map<string, number> = new Map();
	private colorScale: ScaleLinear<string, string>;
	private legendGroup: Selection<SVGGElement, unknown, null, undefined> | null = null;
	private legendRect: Selection<SVGRectElement, unknown, null, undefined> | null = null;
	private legendTitle: Selection<SVGTextElement, unknown, null, undefined> | null = null;
	private linearGradient: Selection<SVGLinearGradientElement, unknown, null, undefined> | null =
		null;

	constructor(
		parentElement: HTMLElement,
		data: ImmigrationData[],
		config: WorldMapConfig = defaultConfig
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
		this.mapG = this.svg
			.append('g')
			.attr('transform', `translate(${this.config.margin.left},${this.config.margin.top})`);

		this.projection = this.config.projectionFunc();
		this.path = geoPath().projection(this.projection);

		this.colorScale = scaleLinear<string>()
			.range([sequentialColorSchema[100], sequentialColorSchema[600]])
			.interpolate(interpolateRgb);

		// Initialize the legend
		this.initializeLegend();

		this.updateVis();
	}

	private async loadMap(): Promise<boolean> {
		try {
			const response = await fetch(`${base}/data/original/world.json`);
			this.topoData = await response.json();

			if (this.projection && this.topoData) {
				const objectKey = Object.keys(this.topoData.objects)[0];
				this.geoData = feature(this.topoData, this.topoData.objects[objectKey]);
				if (this.geoData) {
					this.projection.fitSize([this.width, this.height], this.geoData);
					this.geoData.features.forEach((d) => {
						this.centerPoints.set(d.properties?.name ?? '', findOptimalCenterPoint(d));
					});
				}
			}

			return !!this.geoData;
		} catch (error) {
			console.error('Load TopoJSON map data error:', error);
			return false;
		}
	}

	async updateVis() {
		await this.loadMap();

		// 重置计数映射
		this.countryCountMap.clear();

		this.filteredData = this.data
			.filter((d) => !get(selectedCountry) || d.country === get(selectedCountry))
			.filter((d) => !get(selectedNeighbourhood) || d.neighbourhood === get(selectedNeighbourhood));

		this.filteredData.forEach((d) => {
			const newCount = this.countryCountMap.get(d.country) ?? 0;
			this.countryCountMap.set(d.country, newCount + d.count);
		});

		const countValues = Array.from(this.countryCountMap.values());
		const extentResult = extent(countValues);

		// 正确处理可能是 undefined 的情况
		const validExtent: [number, number] = [
			extentResult[0] !== undefined ? extentResult[0] : 0,
			extentResult[1] !== undefined ? extentResult[1] : 1
		];

		this.colorScale.domain([validExtent[0], validExtent[1]]);

		// Update legend
		this.updateLegend(validExtent[0], validExtent[1]);

		this.renderVis();
	}

	private renderVis() {
		if (!this.topoData || !this.geoData) return;

		const sortedFeatures = [...this.geoData.features].sort((a, b) => {
			const aIsSelected = a.properties?.name === get(selectedCountry);
			const bIsSelected = b.properties?.name === get(selectedCountry);
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
			.selectAll<SVGPathElement, GeoFeature>('.country')
			.data(sortedFeatures)
			.join('path')
			.attr('class', 'country')
			.attr('d', (d) => this.path(d))
			.attr('fill', (d) => {
				const countryName = d.properties?.name;
				if (!countryName || !this.countryCountMap.has(countryName)) {
					return '#ddd'; // 灰色表示没有数据
				}

				const count = this.countryCountMap.get(countryName);
				// 使用颜色比例尺根据count值生成颜色 - 值越大颜色越接近 colorSchema[0]，越小越接近白色
				return this.colorScale(count!);
			})
			.attr('stroke', (d) =>
				d.properties?.name === get(selectedCountry) ? colorSchema[2] : '#fff'
			)
			.attr('stroke-width', 0.5)
			.on('mousedown', (_event, d) => {
				const name = d.properties?.name;
				if (!name) return;

				selectedCountry.update((value) => {
					if (value === name) {
						return null;
					} else {
						selectedNeighbourhood.set(null);
						return name;
					}
				});
			})
			.on('mouseover', (event, d) => {
				const countryName = d.properties?.name;
				const countSum = countryName ? this.countryCountMap.get(countryName) || 0 : 0;

				const layerX = event.clientX - this.parentElement.getBoundingClientRect().left;
				const layerY = event.clientY - this.parentElement.getBoundingClientRect().top;

				tooltip
					.style('opacity', 1)
					.html(`${countryName}<br><strong>Immigration Count:</strong> ${countSum}`)
					.style('left', layerX + this.config.tooltip.padding + 'px')
					.style('top', layerY + this.config.tooltip.padding + 'px');
			})
			.on('mousemove', (event) => {
				const layerX = event.clientX - this.parentElement.getBoundingClientRect().left;
				const layerY = event.clientY - this.parentElement.getBoundingClientRect().top;

				tooltip
					.style('left', layerX + this.config.tooltip.padding + 'px')
					.style('top', layerY + this.config.tooltip.padding + 'px');
			})
			.on('mouseleave', () => {
				tooltip.style('opacity', 0);
			});

		this.mapG
			.selectAll<SVGCircleElement, GeoFeature>('.country-center')
			.data(this.config.centerPoint.show ? this.geoData.features : [])
			.join('circle')
			.attr('class', 'country-center')
			.attr('r', this.config.centerPoint.radius)
			.attr('fill', this.config.centerPoint.color)
			.attr('transform', (d) => {
				const centerPoint = findOptimalCenterPoint(d);
				const projectedPoint = this.projection(centerPoint);
				return projectedPoint ? `translate(${projectedPoint[0]},${projectedPoint[1]})` : '';
			});
	}

	resize(width: number, height: number): void {
		// Update dimensions
		this.width = width - this.config.margin.left - this.config.margin.right;
		this.height = height - this.config.margin.top - this.config.margin.bottom;

		// Update SVG dimensions
		this.svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

		// Update legend position on resize
		if (this.legendGroup) {
			this.legendGroup.attr('transform', `translate(${this.width - 160}, ${this.height - 40})`);
		}

		this.updateVis();
	}

	getCenterPosition(name: string): [number, number] | null {
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
			.attr('id', 'world-legend-gradient')
			.attr('x1', '0%')
			.attr('y1', '0%')
			.attr('x2', '100%')
			.attr('y2', '0%');

		// Create legend group
		this.legendGroup = this.svg
			.append('g')
			.attr('class', 'legend-group')
			.attr('transform', `translate(${this.width - 160}, ${this.height - 40})`);

		// Append legend title
		this.legendTitle = this.legendGroup
			.append('text')
			.attr('class', 'legend-title semibold')
			.attr('y', -5)
			.attr('x', 0)
			.style('font-size', '12px')
			.text('Recent Immigration Count');

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

	private updateLegend(minValue: number, maxValue: number) {
		if (!this.legendGroup || !this.legendRect || !this.legendTitle || !this.linearGradient) return;

		// Update gradient stops
		this.linearGradient.selectAll('stop').remove();
		this.linearGradient
			.append('stop')
			.attr('offset', '0%')
			.attr('stop-color', sequentialColorSchema[100]);
		this.linearGradient
			.append('stop')
			.attr('offset', '100%')
			.attr('stop-color', sequentialColorSchema[600]);

		// Update legend rect fill
		this.legendRect.attr('fill', 'url(#world-legend-gradient)');

		// Update min and max values
		this.legendGroup.select('.min-value').text(minValue.toFixed(0));
		this.legendGroup.select('.max-value').text(maxValue.toFixed(0));
	}
}
