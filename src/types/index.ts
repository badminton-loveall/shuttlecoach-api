// User and Authentication Types
export enum UserRole {
  HEAD_COACH = 'HEAD_COACH',
  ASSISTANT_COACH = 'ASSISTANT_COACH',
  STUDENT = 'STUDENT',
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
