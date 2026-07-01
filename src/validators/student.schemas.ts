import { z } from 'zod';

/**
 * Validation schema for creating a student
 */
export const createStudentSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name must be at most 100 characters'),
    dateOfBirth: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), 'Invalid date format')
      .refine((date) => new Date(date) <= new Date(), 'Date of birth cannot be in the future'),
    gender: z.enum(['Male', 'Female', 'Other']),
    contactPhone: z
      .string()
      .regex(/^\+?[\d\s\-()]{10,20}$/, 'Invalid phone number format'),
    email: z.string().email('Invalid email format').optional(),
    guardianName: z.string().min(2, 'Guardian name must be at least 2 characters').optional(),
    guardianPhone: z
      .string()
      .regex(/^\+?[\d\s\-()]{10,20}$/, 'Invalid phone number format')
      .optional(),
    baidNumber: z.string().max(50).optional(),
    batchId: z.string().uuid('Invalid batch ID').optional(),
    assignedCoachId: z.string().uuid('Invalid coach ID').optional(),
    profilePhoto: z.string().url('Profile photo must be a valid URL').optional(),
    height: z.number().positive('Height must be positive').max(300, 'Invalid height').optional(),
    weight: z.number().positive('Weight must be positive').max(500, 'Invalid weight').optional(),
    bloodGroup: z.string().max(10).optional(),
    medicalConditions: z.string().max(500, 'Medical conditions must be at most 500 characters').optional(),
    emergencyContact: z.string().max(200).optional(),
    strengths: z.array(z.string()).optional(),
    weaknesses: z.array(z.string()).optional(),
    coachFeedback: z.string().max(1000, 'Coach feedback must be at most 1000 characters').optional(),
    skillLevel: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Professional']).optional(),
  })
  .refine(
    (data) => {
      // Check if student is under 18 and requires guardian info
      const age = calculateAge(new Date(data.dateOfBirth));
      if (age < 18) {
        return !!data.guardianName && !!data.guardianPhone;
      }
      return true;
    },
    {
      message: 'Guardian name and phone are required for students under 18',
      path: ['guardianName'],
    }
  );

/**
 * Validation schema for updating a student
 */
export const updateStudentSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name must be at most 100 characters')
      .optional(),
    dateOfBirth: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), 'Invalid date format')
      .refine((date) => new Date(date) <= new Date(), 'Date of birth cannot be in the future')
      .optional(),
    gender: z
      .enum(['Male', 'Female', 'Other'])
      .optional(),
    contactPhone: z
      .string()
      .regex(/^\+?[\d\s\-()]{10,20}$/, 'Invalid phone number format')
      .optional(),
    email: z.string().email('Invalid email format').optional(),
    guardianName: z.string().min(2, 'Guardian name must be at least 2 characters').optional(),
    guardianPhone: z
      .string()
      .regex(/^\+?[\d\s\-()]{10,20}$/, 'Invalid phone number format')
      .optional(),
    baidNumber: z.string().max(50).optional(),
    batchId: z.string().uuid('Invalid batch ID').optional(),
    assignedCoachId: z.string().uuid('Invalid coach ID').optional(),
    profilePhoto: z.string().url('Profile photo must be a valid URL').optional(),
    height: z.number().positive('Height must be positive').max(300, 'Invalid height').optional(),
    weight: z.number().positive('Weight must be positive').max(500, 'Invalid weight').optional(),
    bloodGroup: z.string().max(10).optional(),
    medicalConditions: z.string().max(500, 'Medical conditions must be at most 500 characters').optional(),
    emergencyContact: z.string().max(200).optional(),
    strengths: z.array(z.string()).optional(),
    weaknesses: z.array(z.string()).optional(),
    coachFeedback: z.string().max(1000, 'Coach feedback must be at most 1000 characters').optional(),
    skillLevel: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Professional']).optional(),
  })
  .strict();

/**
 * Validation schema for query parameters when listing students
 */
export const listStudentsQuerySchema = z.object({
  batch: z.string().uuid('Invalid batch ID').optional(),
  coach: z.string().uuid('Invalid coach ID').optional(),
  search: z.string().max(100).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

/**
 * Helper function to calculate age from date of birth
 */
function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }

  return age;
}

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
