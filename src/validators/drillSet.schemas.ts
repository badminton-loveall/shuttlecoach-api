import { z } from 'zod';
import { sportSchema } from './drill.schemas';

const setStatusSchema = z.enum(['draft', 'pending_review', 'published', 'rejected']);

export const createDrillSetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().max(1000, 'Description must be at most 1000 characters').optional(),
  sport: sportSchema.optional(),
});

export const updateDrillSetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters').optional(),
  description: z.string().max(1000, 'Description must be at most 1000 characters').optional(),
  sport: sportSchema.optional(),
}).strict();

export const createSetCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
});

export const updateSetCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
});

export const addDrillToSetCategorySchema = z.object({
  drillId: z.string().min(1, 'Drill ID is required'),
});

export const rejectSetSchema = z.object({
  reason: z.string().max(500, 'Reason must be at most 500 characters').optional(),
});

export const adoptSetSchema = z.object({
  setId: z.string().min(1, 'Set ID is required'),
});

export const listOwnSetsQuerySchema = z.object({
  status: setStatusSchema.optional(),
});

export const setMarketplaceQuerySchema = z.object({
  sport: sportSchema.optional(),
  search: z.string().max(100).optional(),
});

export const adminSetQuerySchema = z.object({
  status: z.union([setStatusSchema, z.literal('all')]).optional(),
});

export const toggleSetEnabledSchema = z.object({
  enabled: z.boolean(),
}).strict();

export type CreateDrillSetInput = z.infer<typeof createDrillSetSchema>;
export type UpdateDrillSetInput = z.infer<typeof updateDrillSetSchema>;
export type CreateSetCategoryInput = z.infer<typeof createSetCategorySchema>;
export type UpdateSetCategoryInput = z.infer<typeof updateSetCategorySchema>;
export type AddDrillToSetCategoryInput = z.infer<typeof addDrillToSetCategorySchema>;
export type RejectSetInput = z.infer<typeof rejectSetSchema>;
export type AdoptSetInput = z.infer<typeof adoptSetSchema>;
export type ToggleSetEnabledInput = z.infer<typeof toggleSetEnabledSchema>;
