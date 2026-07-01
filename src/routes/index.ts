import { Router } from 'express';
import { healthCheck } from '../controllers/health';
import authRoutes from './auth';
import studentRoutes from './students';
import assessmentRoutes from './assessments';
import feeRoutes from './fees';
import curriculumRoutes from './curriculum';
import trainingLogRoutes from './trainingLogs';
import coachRoutes from './coaches';

const router = Router();

// Health check route
router.get('/health', healthCheck);

// Authentication routes
router.use('/auth', authRoutes);

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

export default router;
