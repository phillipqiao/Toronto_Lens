import merge from 'deepmerge';
import { select, type Selection, rollup } from 'd3';
import { WorldMap } from '../world-map/world-map';
import { TorontoMap } from '../toronto-map/toronto-map';
import type { ImmigrationData } from '$lib/types/data/immigration';
import { selectedCountry, selectedNeighbourhood } from '$lib/stores/map';
import { get } from 'svelte/store';
import type { MapConfig } from '$lib/types/chart/layout';
import { colorSchema } from '$lib/utils/colorSchema';
import type { NeighbourhoodData } from '$lib/types/data/neighbourhood';

const defaultConfig: Required<MapConfig> = {
	margin: {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0
	},
	animationDuration: 10000
};
export class Maps {
	private parentElement: HTMLElement;
	private immigrationData: ImmigrationData[];
	private config: Required<MapConfig>;
	private width: number;
	private height: number;
	private torontoContainer: Selection<HTMLDivElement, unknown, null, undefined>;
	private worldContainer: Selection<HTMLDivElement, unknown, null, undefined>;
	private torontoMap: TorontoMap;
	private worldMap: WorldMap;
	private svg: Selection<SVGSVGElement, unknown, null, undefined>;
	private filteredData: ImmigrationData[] = [];

	constructor(
		parentElement: HTMLElement,
		immigrationData: ImmigrationData[],
		neighbourhoodData: NeighbourhoodData[],
		config: MapConfig = defaultConfig
	) {
		this.parentElement = parentElement;
		this.config = merge(defaultConfig, config);
		this.immigrationData = immigrationData.filter(
			(d) => d.count > 0 && d.neighbourhood !== 'City of Toronto'
		);

		const containerRect = this.parentElement.getBoundingClientRect();
		this.width = containerRect.width - this.config.margin.left - this.config.margin.right;
		this.height = containerRect.height - this.config.margin.top - this.config.margin.bottom;

		const container = select(this.parentElement);
		this.torontoContainer = container.append('div').attr('class', 'w-full h-1/2 relative');
		this.worldContainer = container.append('div').attr('class', 'w-full h-1/2 relative');
		this.svg = container
			.append('svg')
			.attr('width', this.width)
			.attr('height', this.height)
			.attr('class', 'absolute top-0 left-0 w-full h-full')
			.style('pointer-events', 'none')
			.style('z-index', '10');

		const torontoMapElement = this.torontoContainer.node();
		const worldMapElement = this.worldContainer.node();
		if (!worldMapElement || !torontoMapElement) {
			throw new Error('Map elements not found');
		}
		this.worldMap = new WorldMap(worldMapElement, this.immigrationData, {
			margin: {
				top: 0,
				right: 0,
				bottom: 0,
				left: 0
			}
		});
		this.torontoMap = new TorontoMap(torontoMapElement, neighbourhoodData, {
			margin: {
				top: 0,
				right: 0,
				bottom: 10,
				left: 0
			}
		});
	}

	public resize(width: number, height: number) {
		this.width = width - this.config.margin.left - this.config.margin.right;
		this.height = height - this.config.margin.top - this.config.margin.bottom;

		this.worldMap.resize(this.width, this.height / 2);
		this.torontoMap.resize(this.width, this.height / 2);

		this.updateVis();
	}

	public async updateVis() {
		await this.worldMap.updateVis();
		await this.torontoMap.updateVis();

		if (get(selectedCountry) || get(selectedNeighbourhood)) {
			this.filteredData = this.immigrationData
				.filter((d) => !get(selectedCountry) || d.country === get(selectedCountry))
				.filter(
					(d) => !get(selectedNeighbourhood) || d.neighbourhood === get(selectedNeighbourhood)
				);
		} else {
			const countrySums = rollup(
				this.immigrationData,
				(values) => values.reduce((sum, d) => sum + d.count, 0),
				(d) => d.country
			);

			this.filteredData = Array.from(countrySums, ([country, count]) => ({
				country,
				neighbourhood: 'City of Toronto',
				count
			}));
		}

		this.renderVis();
	}

	private renderVis() {
		const connectionsData = this.filteredData
			.map((d) => {
				const torontoCenter = this.torontoMap.getCenterPosition(d.neighbourhood);
				const worldCenter = this.worldMap.getCenterPosition(d.country);

				return {
					original: d,
					target: torontoCenter ? torontoCenter : [0, 0],
					source: worldCenter ? [worldCenter[0], worldCenter[1] + this.height / 2] : [0, 0],
					valid: !!torontoCenter && !!worldCenter
				};
			})
			.filter((d) => d.valid);

		const maxCount = Math.max(...connectionsData.map((d) => d.original.count));
		const minCount = Math.min(...connectionsData.map((d) => d.original.count));

		this.svg.selectAll('.flow-dot').remove();

		this.svg
			.selectAll('.data-connection-line')
			.data(connectionsData)
			.join('line')
			.attr('class', 'data-connection-line')
			.attr('stroke', '#333')
			.attr('stroke-width', (d) => {
				const normalizedCount = (d.original.count - minCount) / (maxCount - minCount);
				return normalizedCount * 2 + 0.1;
			})
			.style('pointer-events', 'none')
			.attr('x1', (d) => d.source[0])
			.attr('y1', (d) => d.source[1])
			.attr('x2', (d) => d.target[0])
			.attr('y2', (d) => d.target[1]);

		connectionsData.forEach((connection) => {
			const numDots = Math.ceil((connection.original.count / maxCount) * 8) + 1;

			for (let i = 0; i < numDots; i++) {
				const animationDuration = this.config.animationDuration;
				this.svg
					.append('circle')
					.attr('class', 'flow-dot')
					.attr('r', 3)
					.attr('fill', colorSchema[2])
					.style('opacity', 0)
					.attr('cx', connection.source[0])
					.attr('cy', connection.source[1])
					.transition()
					.delay(i * (animationDuration / numDots))
					.style('opacity', 0.6)
					.transition()
					.duration(animationDuration)
					.attr('cx', connection.target[0])
					.attr('cy', connection.target[1])
					.on('end', function repeat() {
						select(this)
							.attr('cx', connection.source[0])
							.attr('cy', connection.source[1])
							.transition()
							.duration(animationDuration)
							.attr('cx', connection.target[0])
							.attr('cy', connection.target[1])
							.on('end', repeat);
					});
			}
		});
	}
}
