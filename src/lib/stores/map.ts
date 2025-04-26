import { writable } from 'svelte/store';

export const selectedNeighbourhood = writable<string | null>(null);
export const selectedCountry = writable<string | null>(null);
export const selectedMetric = writable('population_density');
