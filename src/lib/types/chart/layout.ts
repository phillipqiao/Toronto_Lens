import type { GeoProjection } from 'd3';

export interface LayoutConfig {
	margin?: {
		top: number;
		right: number;
		bottom: number;
		left: number;
	};
}

export interface TorontoMapConfig extends LayoutConfig {
	projectionFunc?: () => GeoProjection;
	tooltip?: {
		padding: number;
	};
	centerPoint?: {
		precision: number;
		show: boolean;
		radius: number;
		color: string;
	};
}

export interface WorldMapConfig extends LayoutConfig {
	projectionFunc?: () => GeoProjection;
	centerPoint?: {
		precision: number;
		show: boolean;
		radius: number;
		color: string;
	};
	tooltip?: {
		padding: number;
	};
}

export interface MapConfig extends LayoutConfig {
	animationDuration?: number;
}

export interface CrimeRateConfig extends LayoutConfig {
	tooltip?: {
		padding: number;
	};
	legend?: {
		width: number;
		height: number;
		radius: number;
	};
}

export interface LanguageConfig extends LayoutConfig {
	tooltip?: {
		padding: number;
	};
	legend?: {
		width: number;
		height: number;
		radius: number;
	};
}
