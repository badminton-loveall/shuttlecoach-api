import { z } from 'zod';

// --- Shared Validators ---

const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid ISO date (YYYY-MM-DD)');
const timeString = z.string().regex(/^\d{2}:\d{2}$/, 'Must be a valid time (HH:MM)');
const uuidString = z.string().uuid('Must be a valid UUID');
const dayOfWeek = z.number().int().min(0).max(6);

// --- POST /api/attendance ---

export const markAttendanceRecordSchema = z.object({
  studentId: uuidString,
  status: z.enum(['PRESENT', 'ABSENT', 'LATE']),
  leaveType: z.enum(['PLANNED_LEAVE', 'SICK_LEAVE', 'NO_SHOW']).optional(),
});

export const markAttendanceRequestSchema = z.object({
  batchId: uuidString,
  sessionDate: isoDateString,
  records: z.array(markAttendanceRecordSchema).min(1, 'At least one attendance record is required'),
});

// --- GET /api/attendance ---

export const getAttendanceQuerySchema = z.object({
  batchId: uuidString.optional(),
  studentId: uuidString.optional(),
  startDate: isoDateString.optional(),
  endDate: isoDateString.optional(),
});

// --- GET /api/attendance/stats ---

export const getAttendanceStatsQuerySchema = z.object({
  batchId: uuidString.optional(),
  studentId: uuidString.optional(),
  startDate: isoDateString.optional(),
  endDate: isoDateString.optional(),
});

// --- POST /api/leave-requests ---

export const createLeaveRequestSchema = z.object({
  studentId: uuidString,
  batchId: uuidString,
  requestedDate: isoDateString,
  leaveType: z.enum(['PLANNED_LEAVE', 'SICK_LEAVE']),
  reason: z.string().max(500).optional(),
});

// --- PATCH /api/leave-requests/:id ---

export const reviewLeaveRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

// --- GET /api/leave-requests ---

export const getLeaveRequestsQuerySchema = z.object({
  batchId: uuidString.optional(),
  studentId: uuidString.optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

// --- Session Slot & Recurrence Schemas ---

export const sessionSlotSchema = z.object({
  dayOfWeek: dayOfWeek,
  startTime: timeString,
  endTime: timeString,
});

export const recurrencePatternSchema = z.object({
  repeatEvery: z.number().int().min(1, 'Repeat interval must be at least 1'),
  repeatUnit: z.literal('week'),
  repeatDays: z.array(dayOfWeek).min(1, 'At least one repeat day is required'),
  endType: z.enum(['never', 'on_date', 'after_count']),
  endDate: isoDateString.optional(),
  occurrenceCount: z.number().int().min(1).optional(),
});

// --- POST /api/session-schedules ---

export const createSessionScheduleSchema = z.object({
  batchId: uuidString,
  slots: z.array(sessionSlotSchema).min(1, 'At least one session slot is required'),
  recurrence: recurrencePatternSchema,
  cycleStartDate: isoDateString.optional(),
});

// --- GET /api/session-calendar ---

export const getSessionCalendarQuerySchema = z.object({
  batchId: uuidString.optional(),
  studentId: uuidString.optional(),
  startDate: isoDateString,
  endDate: isoDateString,
});

// --- POST /api/session-notes ---

export const createSessionNoteSchema = z.object({
  batchId: uuidString,
  sessionDate: isoDateString,
  noteText: z.string().min(1, 'Note text is required').max(2000),
});

// --- GET /api/session-notes ---

export const getSessionNotesQuerySchema = z.object({
  startDate: isoDateString.optional(),
  endDate: isoDateString.optional(),
});

// --- GET /api/analytics/session/:cycleKey ---

export const getDrillCompletionQuerySchema = z.object({
  batchId: uuidString,
  weekNumber: z.coerce.number().int().min(1).max(8).optional(),
});

// --- GET /api/analytics/effectiveness/:studentId ---

export const getEffectivenessQuerySchema = z.object({
  cycleKey: z.string().min(1, 'Cycle key is required'),
});

// --- GET /api/analytics/comparison/batches ---

export const getBatchComparisonQuerySchema = z.object({
  cycleKey: z.string().min(1, 'Cycle key is required'),
});

// --- GET /api/analytics/comparison/students ---

export const getStudentComparisonQuerySchema = z.object({
  batchId: uuidString,
  cycleKey: z.string().min(1, 'Cycle key is required'),
});

// --- GET /api/analytics/trends/:studentId (no query params needed) ---

// --- GET /api/analytics/patterns ---

export const getTrainingPatternsQuerySchema = z.object({
  batchId: uuidString.optional(),
  startDate: isoDateString,
  endDate: isoDateString,
});
