import { z } from 'zod';

export const languageSchema = z.record(z.union([z.string(), z.number()]));

export type LanguageData = z.infer<typeof languageSchema>;
