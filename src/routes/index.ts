import { Router } from 'express';
import { healthCheck } from '../controllers/health';
import authRoutes from './auth';
import adminRoutes from './admin';
import studentRoutes from './students';
import assessmentRoutes from './assessments';
import feeRoutes from './fees';
import curriculumRoutes from './curriculum';
import trainingLogRoutes from './trainingLogs';
import coachRoutes from './coaches';
import drillRoutes from './drills';
import batchRoutes from './batches';
import skillScoresRoutes from './skillScores';
import sessionScheduleRoutes from './sessionSchedules';
import { sessionCalendarRouter } from './sessionSchedules';
import leaveRequestRoutes from './leaveRequests';
import attendanceRoutes from './attendance';
import sessionNotesRoutes from './sessionNotes';
import analyticsRoutes from './analytics';
import membershipRoutes from './memberships';
import { slugChangeRequestRouter, adminSlugChangeRequestRouter } from './slugChangeRequests';
import batchTimeTemplateRoutes from './batchTimeTemplates';
import batchCoachAssignmentRoutes from './batchCoachAssignments';
import studentAssignmentRoutes from './studentAssignments';
import onboardingChecklistRoutes from './onboardingChecklist';
import ledgerRoutes from './ledger';
import salaryRoutes from './salary';
import { getCenterInfo } from '../controllers/public/centers';

const router = Router();

// Health check route
router.get('/health', healthCheck);

// Authentication routes
router.use('/auth', authRoutes);

// Admin routes (ADMIN role only — auth + authorize applied internally by admin router)
router.use('/admin', adminRoutes);

// Student routes
router.use('/students', studentRoutes);

// Assessment routes
router.use('/assessments', assessmentRoutes);

// Fee routes
router.use('/fees', feeRoutes);

// Curriculum routes
router.use('/curriculum', curriculumRoutes);

// Training log routes
router.use('/training-logs', trainingLogRoutes);

// Coach management routes
router.use('/coaches', coachRoutes);

// Drill management routes
router.use('/drills', drillRoutes);

// Student assignment routes (nested under batches — registered before /batches to avoid conflicts)
router.use('/batches/:batchId/students', studentAssignmentRoutes);

// Batch coach assignment routes (nested under batches — registered before /batches to avoid conflicts)
router.use('/batches/:batchId/coaches', batchCoachAssignmentRoutes);

// Batch management routes
router.use('/batches', batchRoutes);

// Batch time template routes
router.use('/batch-time-templates', batchTimeTemplateRoutes);

// Skill scores routes
router.use('/skill-scores', skillScoresRoutes);

// Attendance routes
router.use('/attendance', attendanceRoutes);

// Leave request routes
router.use('/leave-requests', leaveRequestRoutes);

// Session notes routes
router.use('/session-notes', sessionNotesRoutes);

// Session schedule routes
router.use('/session-schedules', sessionScheduleRoutes);

// Session calendar route (separate path per design: /api/session-calendar)
router.use('/session-calendar', sessionCalendarRouter);

// Analytics routes
router.use('/analytics', analyticsRoutes);

// Membership routes
router.use('/memberships', membershipRoutes);

// Slug change request routes (HEAD_COACH submission)
router.use('/slug-change-requests', slugChangeRequestRouter);

// Admin slug change request routes (ADMIN approval/rejection)
router.use('/admin/slug-change-requests', adminSlugChangeRequestRouter);

// Onboarding checklist routes (HEAD_COACH only)
router.use('/onboarding-checklist', onboardingChecklistRoutes);

// Ledger routes (financial ledger for fee/salary tracking)
router.use('/ledger', ledgerRoutes);

// Salary routes (salary generation, listing, pay/revert)
router.use('/salary', salaryRoutes);

// Public center info route (no auth)
router.get('/centers/:slug/info', getCenterInfo);

export default router;
