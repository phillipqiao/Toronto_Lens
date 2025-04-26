import { z } from 'zod';

export const crimeCategories = [
	'Assault',
	'Auto Theft',
	'Burglary',
	'Robbery',
	'Theft Over',
	'Homicide',
	'Shootings'
] as const;

export type CrimeCategory = (typeof crimeCategories)[number];

export const crimeRateSchema = z.object({
	year: z.coerce.number(),
	crime_type: z.string(),
	crime_rate: z.coerce.number(),
	neighbourhood: z.string()
});

export type CrimeData = z.infer<typeof crimeRateSchema>;
