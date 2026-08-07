// User and Authentication Types
export enum UserRole {
  ADMIN = 'ADMIN',
  HEAD_COACH = 'HEAD_COACH',
  ASSISTANT_COACH = 'ASSISTANT_COACH',
  STUDENT = 'STUDENT',
}

export interface Center {
  id: string;
  name: string;
  location: string;
  contactPhone?: string;
  contactEmail?: string;
  logoUrl?: string;
  isActive: boolean;
  headCoachId?: string;
  planType?: string;
  subscriptionExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  email?: string;
  profilePhoto?: string;
  specialization?: string;
  canAccessFees?: boolean;
  createdAt: Date;
  lastActive: Date;
}

// Student Types
export interface Student {
  id: string;
  fullName: string;
  dateOfBirth: Date;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  contactPhone: string;
  email?: string;
  guardianName?: string;
  guardianPhone?: string;
  baidNumber?: string;
  batchId?: string;
  assignedCoachId?: string;
  profilePhoto?: string;
  height?: number;
  weight?: number;
  bmi?: number;
  bloodGroup?: string;
  medicalConditions?: string;
  emergencyContact?: string;
  strengths: string[];
  weaknesses: string[];
  coachFeedback?: string;
  skillLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional';
  status?: 'active' | 'archived';
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Skill Assessment Types
export type SkillScore = 0 | 1 | 2 | 3 | 4;

export interface CategoryScores {
  [skillName: string]: SkillScore;
}

export interface SkillScores {
  forehand: CategoryScores;
  backhand: CategoryScores;
  return: CategoryScores;
  service: CategoryScores;
  overhead: CategoryScores;
  rally: CategoryScores;
}

export interface SkillAssessment {
  id: string;
  studentId: string;
  cycleKey: string;
  recordedBy: string;
  recordedAt: Date;
  scores: SkillScores;
  isLocked: boolean;
}

// Fee Management Types
export enum FeeStatus {
  PAID = 'PAID',
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE',
  WAIVED = 'WAIVED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  UPI = 'UPI',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export interface FeeRecord {
  id: string;
  studentId: string;
  amount: number;
  monthYear: string;
  dueDate: Date;
  paidDate?: Date;
  status: FeeStatus;
  paymentMethod?: PaymentMethod;
  transactionRef?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Curriculum Types
export interface Drill {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface WeekPlan {
  weekNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  focusArea: string;
  drills: Drill[];
  objective: string;
}

export interface CurriculumPlan {
  id: string;
  cycleKey: string;
  batchId?: string;
  studentId?: string;
  sourceBatchPlanId?: string;
  weeks: WeekPlan[];
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
}

// Training Log Types
export interface TrainingLog {
  id: string;
  studentId: string;
  weekNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  cycleKey: string;
  sessionNotes: string;
  isCompleted: boolean;
  recordedBy: string;
  recordedAt: Date;
}

// Batch Types
export interface Batch {
  id: string;
  name: string;
  schedule: string;
  assignedCoachId?: string;
  studentCount: number;
  createdAt: Date;
}

// Request/Response Types
export interface LoginRequest {
  username: string;
  password: string;
  centerSlug?: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<User, 'passwordHash'>;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    username: string;
  };
}

// ============================================================
// Attendance and Training Analysis Types
// ============================================================

// --- Attendance Types ---

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';
export type LeaveType = 'PLANNED_LEAVE' | 'SICK_LEAVE' | 'NO_SHOW';
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  batchId: string;
  sessionDate: string; // ISO date
  status: AttendanceStatus;
  leaveType?: LeaveType;
  markedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveRequest {
  id: string;
  studentId: string;
  batchId: string;
  requestedDate: string; // ISO date
  leaveType: LeaveType;
  reason?: string;
  status: LeaveRequestStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
}

// --- Session Schedule Types ---

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun=0 through Sat=6
export type EndType = 'never' | 'on_date' | 'after_count';

export interface SessionSlot {
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:MM" 24-hour format
  endTime: string;   // "HH:MM" 24-hour format
}

export interface RecurrencePattern {
  repeatEvery: number;    // e.g., 1 = every week, 2 = every other week
  repeatUnit: 'week';
  repeatDays: DayOfWeek[];
  endType: EndType;
  endDate?: string;       // ISO date, when endType = 'on_date'
  occurrenceCount?: number; // when endType = 'after_count'
}

export interface SessionSchedule {
  id: string;
  batchId: string;
  slots: SessionSlot[];
  recurrence: RecurrencePattern;
  cycleStartDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionNote {
  id: string;
  batchId: string;
  sessionDate: string;
  noteText: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CurriculumWeekMapping {
  id: string;
  batchId: string;
  cycleKey: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
}

// --- Analytics Types ---

export interface AttendanceStats {
  studentId: string;
  studentName: string;
  totalSessions: number;
  attended: number;
  late: number;
  absent: number;
  attendancePercentage: number; // 0-100
}

export interface DrillCompletionStats {
  weekNumber: number;
  focusArea: string;
  totalDrills: number;
  completedDrills: number;
  completionRate: number; // 0-100
  drills: Array<{
    name: string;
    category: string;
    completed: boolean;
    notes?: string;
  }>;
}

export interface SkillImprovementDelta {
  category: string;
  startScore: number;
  endScore: number;
  delta: number;
  relatedDrills: string[];
  drillCompletionRate: number;
}

export interface TrainingEffectivenessReport {
  studentId: string;
  cycleKey: string;
  overallScore: number; // Training Effectiveness Score
  categories: SkillImprovementDelta[];
  insufficientData: boolean;
}

export interface BatchComparisonMetric {
  batchId: string;
  batchName: string;
  avgSkillImprovement: number;
  avgAttendancePercentage: number;
  avgDrillCompletionRate: number;
}

export interface TrendDataPoint {
  cycleKey: string;
  attendancePercentage: number;
  avgSkillScore: number;
}

export interface StudentTrendReport {
  studentId: string;
  dataPoints: TrendDataPoint[];
  correlationCoefficient?: number; // Only if >= 3 cycles
}

// --- Calendar Entry (generated from schedule) ---

export interface CalendarEntry {
  date: string; // ISO date
  batchId: string;
  batchName: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  weekNumber?: number;
  focusArea?: string;
  drills?: Array<{ name: string; category: string }>;
  attendanceRecorded?: boolean;
  coachNote?: string;
}

// --- Training Pattern Types ---

export interface CategoryDistribution {
  category: string;
  drillCount: number;
  proportion: number; // 0-100
}

export interface TrainingPatternReport {
  categoryDistributions: CategoryDistribution[];
  attendanceHeatmap: Array<{
    dayOfWeek: DayOfWeek;
    weekNumber: number;
    attendanceRate: number;
  }>;
}

// ============================================================
// Request/Response Types for Attendance & Analytics Endpoints
// ============================================================

// --- POST /api/attendance ---

export interface MarkAttendanceRequestRecord {
  studentId: string;
  status: AttendanceStatus;
  leaveType?: LeaveType;
}

export interface MarkAttendanceRequest {
  batchId: string;
  sessionDate: string; // ISO date
  records: MarkAttendanceRequestRecord[];
}

export interface MarkAttendanceResponse {
  success: boolean;
  recordCount: number;
}

// --- GET /api/attendance ---

export interface GetAttendanceQuery {
  batchId?: string;
  studentId?: string;
  startDate?: string; // ISO date
  endDate?: string;   // ISO date
}

// --- GET /api/attendance/stats ---

export interface GetAttendanceStatsQuery {
  batchId?: string;
  studentId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AttendanceStatsResponse {
  stats: AttendanceStats[];
}

// --- POST /api/leave-requests ---

export interface CreateLeaveRequestBody {
  studentId: string;
  batchId: string;
  requestedDate: string; // ISO date, must be future
  leaveType: Exclude<LeaveType, 'NO_SHOW'>; // Only PLANNED_LEAVE or SICK_LEAVE for requests
  reason?: string;
}

// --- PATCH /api/leave-requests/:id ---

export interface ReviewLeaveRequestBody {
  status: Exclude<LeaveRequestStatus, 'PENDING'>; // APPROVED or REJECTED
}

// --- GET /api/leave-requests ---

export interface GetLeaveRequestsQuery {
  batchId?: string;
  studentId?: string;
  status?: LeaveRequestStatus;
}

// --- POST /api/session-schedules ---

export interface CreateSessionScheduleBody {
  batchId: string;
  slots: SessionSlot[];
  recurrence: RecurrencePattern;
  cycleStartDate?: string;
}

// --- GET /api/session-calendar ---

export interface GetSessionCalendarQuery {
  batchId?: string;
  studentId?: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
}

export interface GetSessionCalendarResponse {
  entries: CalendarEntry[];
}

// --- POST /api/session-notes ---

export interface CreateSessionNoteBody {
  batchId: string;
  sessionDate: string; // ISO date
  noteText: string;
}

// --- GET /api/session-notes ---

export interface GetSessionNotesQuery {
  startDate?: string;
  endDate?: string;
}

// --- GET /api/analytics/session/:cycleKey ---

export interface GetDrillCompletionQuery {
  batchId: string;
  weekNumber?: number;
}

export interface DrillCompletionResponse {
  stats: DrillCompletionStats[];
}

// --- GET /api/analytics/effectiveness/:studentId ---

export interface GetEffectivenessQuery {
  cycleKey: string;
}

export interface EffectivenessResponse {
  report: TrainingEffectivenessReport;
}

// --- GET /api/analytics/comparison/batches ---

export interface GetBatchComparisonQuery {
  cycleKey: string;
}

export interface BatchComparisonResponse {
  batches: BatchComparisonMetric[];
}

// --- GET /api/analytics/comparison/students ---

export interface GetStudentComparisonQuery {
  batchId: string;
  cycleKey: string;
}

export interface StudentComparisonResponse {
  students: Array<{
    studentId: string;
    studentName: string;
    skillImprovementDelta: number;
    attendancePercentage: number;
    drillCompletionRate: number;
  }>;
}

// --- GET /api/analytics/trends/:studentId ---

export interface StudentTrendResponse {
  report: StudentTrendReport;
}

// --- GET /api/analytics/patterns ---

export interface GetTrainingPatternsQuery {
  batchId?: string;
  startDate: string;
  endDate: string;
}

export interface TrainingPatternsResponse {
  report: TrainingPatternReport;
}
