import { writable } from 'svelte/store';

export type FilterRange = {
	min: number;
	max: number;
};

export type FilterRanges = {
	population_density: FilterRange;
	household_income: FilterRange;
	crime_rate: FilterRange;
	cultural_diversity: FilterRange;
};

export const rangeSteps = {
	population_density: 100,
	household_income: 1000,
	crime_rate: 10,
	cultural_diversity: 0.1
};

export const fallBackFilterRange: FilterRanges = {
	population_density: { min: 0, max: 0 },
	household_income: { min: 0, max: 0 },
	crime_rate: { min: 0, max: 0 },
	cultural_diversity: { min: 0, max: 0 }
};

export const filterRanges = writable<FilterRanges>(fallBackFilterRange);
