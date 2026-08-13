import { z } from 'zod';

export const sportSchema = z.enum(['badminton', 'tennis', 'table_tennis', 'squash']);

export const createDrillSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be at most 1000 characters'),
  category: z.string().min(1, 'Category is required').max(50, 'Category must be at most 50 characters'),
  sport: sportSchema,
});

export const updateDrillSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters').optional(),
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be at most 1000 characters').optional(),
  category: z.string().min(1, 'Category is required').max(50, 'Category must be at most 50 characters').optional(),
  sport: sportSchema.optional(),
}).strict();

export const createGlobalDrillSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be at most 1000 characters'),
  category: z.string().min(1, 'Category is required').max(50, 'Category must be at most 50 characters'),
  sport: sportSchema,
});

export const adoptDrillSchema = z.object({
  drillId: z.string().min(1, 'Drill ID is required'),
});

export const marketplaceQuerySchema = z.object({
  category: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
});

export const listDrillsQuerySchema = z.object({
  category: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
});

export const adminListDrillsQuerySchema = z.object({
  sport: sportSchema.optional(),
  category: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
});

export type CreateDrillInput = z.infer<typeof createDrillSchema>;
export type UpdateDrillInput = z.infer<typeof updateDrillSchema>;
export type CreateGlobalDrillInput = z.infer<typeof createGlobalDrillSchema>;
export type AdoptDrillInput = z.infer<typeof adoptDrillSchema>;
export type MarketplaceQuery = z.infer<typeof marketplaceQuerySchema>;
export type ListDrillsQuery = z.infer<typeof listDrillsQuerySchema>;
