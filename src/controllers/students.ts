import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { Student, UserRole } from '../types';
import { calculateAge } from '../utils/calculations';

/**
 * POST /api/students
 * Create a new student with validation
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const createStudent = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      fullName,
      dateOfBirth,
      gender,
      contactPhone,
      email,
      guardianName,
      guardianPhone,
      baidNumber,
      batchId,
      assignedCoachId,
      profilePhoto,
      height,
      weight,
      bloodGroup,
      medicalConditions,
      emergencyContact,
      strengths,
      weaknesses,
      coachFeedback,
      skillLevel,
    } = req.body;

    // Validate required fields
    if (!fullName || !dateOfBirth || !gender || !contactPhone) {
      res.status(400).json({
        error: 'Missing required fields: fullName, dateOfBirth, gender, contactPhone',
      });
      return;
    }

    // Check if student is under 18 and requires guardian info
    const age = calculateAge(new Date(dateOfBirth));
    if (age < 18 && (!guardianName || !guardianPhone)) {
      res.status(400).json({
        error: 'Guardian name and phone are required for students under 18',
      });
      return;
    }

    // Insert student into database
    // Note: age and bmi are computed columns
    const result = await query(
      `INSERT INTO students (
        full_name, date_of_birth, gender, contact_phone, email,
        guardian_name, guardian_phone, baid_number, batch_id, assigned_coach_id,
        profile_photo, height, weight, blood_group, medical_conditions,
        emergency_contact, strengths, weaknesses, coach_feedback, skill_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING 
        id, full_name, date_of_birth, age, gender, contact_phone, email,
        guardian_name, guardian_phone, baid_number, batch_id, assigned_coach_id,
        profile_photo, height, weight, bmi, blood_group, medical_conditions,
        emergency_contact, strengths, weaknesses, coach_feedback, skill_level,
        created_at, updated_at`,
      [
        fullName,
        dateOfBirth,
        gender,
        contactPhone,
        email || null,
        guardianName || null,
        guardianPhone || null,
        baidNumber || null,
        batchId || null,
        assignedCoachId || null,
        profilePhoto || null,
        height || null,
        weight || null,
        bloodGroup || null,
        medicalConditions || null,
        emergencyContact || null,
        strengths || [],
        weaknesses || [],
        coachFeedback || null,
        skillLevel || 'Beginner',
      ]
    );

    const student = mapDatabaseRowToStudent(result.rows[0]);
    res.status(201).json(student);
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({
      error: 'An error occurred while creating student',
    });
  }
};

/**
 * GET /api/students
 * List students with filtering and pagination
 * Query params: ?batch=<id>&coach=<id>&search=<name>&page=1&limit=20
 * Authorization: HEAD_COACH sees all, ASSISTANT_COACH sees only assigned students
 */
export const listStudents = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { batch, coach, search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause based on role and filters
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Role-based filtering
    if (req.user.role === UserRole.ASSISTANT_COACH) {
      // Assistant coaches see only assigned students
      conditions.push(`assigned_coach_id = $${paramIndex}`);
      params.push(req.user.id);
      paramIndex++;
    }

    // Batch filter
    if (batch) {
      conditions.push(`batch_id = $${paramIndex}`);
      params.push(batch);
      paramIndex++;
    }

    // Coach filter (only for HEAD_COACH)
    if (coach && req.user.role === UserRole.HEAD_COACH) {
      conditions.push(`assigned_coach_id = $${paramIndex}`);
      params.push(coach);
      paramIndex++;
    }

    // Search filter
    if (search) {
      conditions.push(`(full_name ILIKE $${paramIndex} OR baid_number ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM students ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated students
    const studentsResult = await query(
      `SELECT 
        id, full_name, date_of_birth, age, gender, contact_phone, email,
        guardian_name, guardian_phone, baid_number, batch_id, assigned_coach_id,
        profile_photo, height, weight, bmi, blood_group, medical_conditions,
        emergency_contact, strengths, weaknesses, coach_feedback, skill_level,
        created_at, updated_at
      FROM students
      ${whereClause}
      ORDER BY full_name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitNum, offset]
    );

    const students = studentsResult.rows.map(mapDatabaseRowToStudent);

    res.status(200).json({
      students,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('List students error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching students',
    });
  }
};

/**
 * GET /api/students/:id
 * Fetch a single student by ID
 * Authorization: HEAD_COACH sees all, ASSISTANT_COACH sees only assigned students
 */
export const getStudent = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Fetch student
    const result = await query(
      `SELECT 
        id, full_name, date_of_birth, age, gender, contact_phone, email,
        guardian_name, guardian_phone, baid_number, batch_id, assigned_coach_id,
        profile_photo, height, weight, bmi, blood_group, medical_conditions,
        emergency_contact, strengths, weaknesses, coach_feedback, skill_level,
        created_at, updated_at
      FROM students
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const student = mapDatabaseRowToStudent(result.rows[0]);

    // Authorization check: Assistant coaches can only access assigned students
    if (
      req.user.role === UserRole.ASSISTANT_COACH &&
      student.assignedCoachId !== req.user.id
    ) {
      res.status(403).json({
        error: 'You do not have permission to access this student',
      });
      return;
    }

    res.status(200).json(student);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching student',
    });
  }
};

/**
 * PATCH /api/students/:id
 * Update a student with partial data
 * Authorization: HEAD_COACH can update all, ASSISTANT_COACH can update only assigned students
 */
export const updateStudent = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // First check if student exists and get current data
    const existingResult = await query(
      'SELECT id, assigned_coach_id FROM students WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const existingStudent = existingResult.rows[0];

    // Authorization check: Assistant coaches can only update assigned students
    if (
      req.user.role === UserRole.ASSISTANT_COACH &&
      existingStudent.assigned_coach_id !== req.user.id
    ) {
      res.status(403).json({
        error: 'You do not have permission to update this student',
      });
      return;
    }

    // Build UPDATE query dynamically based on provided fields
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const allowedFields = {
      fullName: 'full_name',
      dateOfBirth: 'date_of_birth',
      gender: 'gender',
      contactPhone: 'contact_phone',
      email: 'email',
      guardianName: 'guardian_name',
      guardianPhone: 'guardian_phone',
      baidNumber: 'baid_number',
      batchId: 'batch_id',
      assignedCoachId: 'assigned_coach_id',
      profilePhoto: 'profile_photo',
      height: 'height',
      weight: 'weight',
      bloodGroup: 'blood_group',
      medicalConditions: 'medical_conditions',
      emergencyContact: 'emergency_contact',
      strengths: 'strengths',
      weaknesses: 'weaknesses',
      coachFeedback: 'coach_feedback',
      skillLevel: 'skill_level',
    };

    Object.entries(allowedFields).forEach(([camelKey, snakeKey]) => {
      if (req.body[camelKey] !== undefined) {
        updates.push(`${snakeKey} = $${paramIndex}`);
        params.push(req.body[camelKey]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    // Add student ID as last parameter
    params.push(id);

    // Execute update
    const result = await query(
      `UPDATE students
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, full_name, date_of_birth, age, gender, contact_phone, email,
        guardian_name, guardian_phone, baid_number, batch_id, assigned_coach_id,
        profile_photo, height, weight, bmi, blood_group, medical_conditions,
        emergency_contact, strengths, weaknesses, coach_feedback, skill_level,
        created_at, updated_at`,
      params
    );

    const student = mapDatabaseRowToStudent(result.rows[0]);
    res.status(200).json(student);
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      error: 'An error occurred while updating student',
    });
  }
};

/**
 * Helper function to map database row to Student type
 */
function mapDatabaseRowToStudent(row: any): Student {
  return {
    id: row.id,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    age: row.age,
    gender: row.gender,
    contactPhone: row.contact_phone,
    email: row.email,
    guardianName: row.guardian_name,
    guardianPhone: row.guardian_phone,
    baidNumber: row.baid_number,
    batchId: row.batch_id,
    assignedCoachId: row.assigned_coach_id,
    profilePhoto: row.profile_photo,
    height: row.height ? parseFloat(row.height) : undefined,
    weight: row.weight ? parseFloat(row.weight) : undefined,
    bmi: row.bmi ? parseFloat(row.bmi) : undefined,
    bloodGroup: row.blood_group,
    medicalConditions: row.medical_conditions,
    emergencyContact: row.emergency_contact,
    strengths: row.strengths || [],
    weaknesses: row.weaknesses || [],
    coachFeedback: row.coach_feedback,
    skillLevel: row.skill_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
