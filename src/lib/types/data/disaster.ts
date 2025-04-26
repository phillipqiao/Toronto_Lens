import { z } from 'zod';

export const disasterCategories = [
	'winter-storm-freeze',
	'drought-wildfire',
	'flooding',
	'tropical-cyclone',
	'severe-storm'
] as const;

export type DisasterCategory = (typeof disasterCategories)[number];

export const disasterSchema = z
	.object({
		mid: z.coerce.date(),
		year: z.coerce.number(),
		name: z.string(),
		category: z.enum(disasterCategories),
		cost: z.coerce.number()
	})
	.transform((data) => ({
		date: data.mid,
		// standardize date to leap year
		// naive way to treat every year as leap year
		standardizedDate: new Date(2000, data.mid.getMonth(), data.mid.getDate()),
		year: data.year,
		name: data.name,
		category: data.category,
		cost: data.cost
	}));

export type DisasterData = z.infer<typeof disasterSchema>;
