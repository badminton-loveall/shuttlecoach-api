import { z } from 'zod';

export const createDrillSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be at most 1000 characters'),
  category: z.string().min(1, 'Category is required').max(50, 'Category must be at most 50 characters'),
});

export const updateDrillSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters').optional(),
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be at most 1000 characters').optional(),
  category: z.string().min(1, 'Category is required').max(50, 'Category must be at most 50 characters').optional(),
}).strict();

export const listDrillsQuerySchema = z.object({
  category: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
});

export type CreateDrillInput = z.infer<typeof createDrillSchema>;
export type UpdateDrillInput = z.infer<typeof updateDrillSchema>;
export type ListDrillsQuery = z.infer<typeof listDrillsQuerySchema>;
