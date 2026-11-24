import { z } from 'zod';
import type { GstStatus } from '../types/database.types';

export const TurnoverBandSchema = z.enum([
  'lt_20l',
  '20l_to_40l',
  '40l_to_1.5cr',
  '1.5cr_to_5cr',
  'gt_5cr',
]);

export type TurnoverBand = z.infer<typeof TurnoverBandSchema>;

export interface TurnoverRange {
  min: number;
  max: number; // in INR
}

export const TURNOVER_BAND_RANGES: Record<TurnoverBand, TurnoverRange> = {
  lt_20l: { min: 0, max: 2000000 },
  '20l_to_40l': { min: 2000000, max: 4000000 },
  '40l_to_1.5cr': { min: 4000000, max: 15000000 },
  '1.5cr_to_5cr': { min: 15000000, max: 50000000 },
  gt_5cr: { min: 50000000, max: Number.MAX_SAFE_INTEGER },
};

export const BusinessProfileSchema = z.object({
  id: z.string().uuid().optional(),
  owner_id: z.string().uuid().optional(),
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  state: z.string().length(2, 'State must be a 2-letter Indian state code (e.g. DL, MH, GJ)'),
  gst_status: z.enum(['registered_regular', 'registered_composition', 'unregistered']),
  turnover_band: TurnoverBandSchema,
  employee_count: z.number().int().nonnegative().default(0),
  industry: z.string().min(2, 'Industry must be specified (e.g. Retail - Apparel, Food Service)'),
  description: z.string().optional().default(''),
  telegram_chat_id: z.string().optional().nullable(),
});

export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;
