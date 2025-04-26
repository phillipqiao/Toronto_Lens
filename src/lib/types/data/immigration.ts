import { z } from 'zod';

export const immigrationSchema = z.object({
	country: z.string(),
	neighbourhood: z.string(),
	count: z.coerce.number()
});

export type ImmigrationData = z.infer<typeof immigrationSchema>;
