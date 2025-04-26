import { z } from 'zod';

export const neighbourhoodSchema = z.object({
	neighbourhood: z.string(),
	crime_count: z.coerce.number(),
	population_2020: z.coerce.number(),
	overall_crime_rate: z.coerce.number(),
	'Land area in square kilometres': z.coerce.number(),
	total_language_population: z.coerce.number(),
	shannon_diversity: z.coerce.number(),
	population_density: z.coerce.number(),
	'Average after-tax income of households in 2015 ($)': z.coerce.number()
});

export type NeighbourhoodData = z.infer<typeof neighbourhoodSchema>;
