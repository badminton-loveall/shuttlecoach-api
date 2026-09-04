import { Response } from 'express';
import crypto from 'crypto';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';
import { Student, UserRole } from '../types';
import { calculateAge } from '../utils/calculations';
import { hashPassword } from '../utils/auth';
import { generateResetToken, hashToken } from '../utils/tokenGenerator';
import { sendStudentWelcomeEmail } from '../services/welcomeEmailService';
import { autoCloneStudentPlan } from '../services/curriculumCloneService';
import { getEffectiveCapacity } from '../services/subscriptionService';
import { ensureCoachAssignedToBatch } from '../services/enrollmentService';

/**
 * POST /api/students
 * Create a new student with validation
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const createStudent = async (
  req: TenantRequest,
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

    // Student Capacity is a marketplace item — a center with no active
    // subscription still gets the catalog's free baseline roster size.
    if (req.tenantCenterId) {
      const capacityLimit = await getEffectiveCapacity(req.tenantCenterId, 'STUDENT_CAPACITY');
      const countResult = await query('SELECT COUNT(*) FROM students WHERE center_id = $1', [req.tenantCenterId]);
      const currentCount = parseInt(countResult.rows[0].count, 10);
      if (currentCount >= capacityLimit) {
        res.status(403).json({
          error: `Student limit reached (${capacityLimit}). Upgrade your Student Capacity plan in the Marketplace to add more students.`,
          code: 'CAPACITY_LIMIT_REACHED',
        });
        return;
      }
    }

    // Insert student into database
    // Note: age and bmi are computed columns
    const result = await query(
      `INSERT INTO students (
        full_name, date_of_birth, gender, contact_phone, email,
        guardian_name, guardian_phone, baid_number, batch_id, assigned_coach_id,
        profile_photo, height, weight, blood_group, medical_conditions,
        emergency_contact, strengths, weaknesses, coach_feedback, skill_level,
        center_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
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
        req.tenantCenterId || null,
      ]
    );

    const student = mapDatabaseRowToStudent(result.rows[0]);
    res.status(201).json(student);

    // Fire-and-forget: auto-clone curriculum plan if student is added to a batch with a course
    if (batchId && student.id) {
      setImmediate(async () => {
        try {
          await autoCloneStudentPlan(student.id, batchId, req.tenantCenterId || null);
        } catch (err) {
          console.error('[CreateStudent] Auto-clone curriculum plan failed:', err);
        }
      });
    }

    // Fire-and-forget: a student's coach should be recorded as assigned to their
    // batch too, so the Coaches page's batch count reflects this immediately.
    if (batchId && assignedCoachId) {
      setImmediate(async () => {
        try {
          await ensureCoachAssignedToBatch(batchId, assignedCoachId);
        } catch (err) {
          console.error('[CreateStudent] Failed to ensure coach-batch assignment:', err);
        }
      });
    }

    // Fire-and-forget: create a login account and send the student welcome email
    // if an email address was provided.
    if (email && req.tenantCenterId) {
      setImmediate(async () => {
        try {
          // Look up center name and contact info
          const centerResult = await query(
            'SELECT name, contact_email, contact_phone FROM centers WHERE id = $1',
            [req.tenantCenterId]
          );

          if (centerResult.rows.length === 0) {
            console.warn(`[CreateStudent] Center ${req.tenantCenterId} not found for welcome email.`);
            return;
          }

          const center = centerResult.rows[0];
          const centerName = center.name;

          // Build center contact info string
          const contactParts: string[] = [];
          if (center.contact_email) {
            contactParts.push(`Email: ${center.contact_email}`);
          }
          if (center.contact_phone) {
            contactParts.push(`Phone: ${center.contact_phone}`);
          }
          const centerContactInfo = contactParts.length > 0
            ? contactParts.join(' | ')
            : 'Contact your center directly';

          // Look up batch name if batchId was provided
          let batchName: string | undefined;
          if (batchId) {
            const batchResult = await query(
              'SELECT name FROM batches WHERE id = $1',
              [batchId]
            );
            if (batchResult.rows.length > 0) {
              batchName = batchResult.rows[0].name;
            }
          }

          const isMinor = age < 18;

          // Create the student's login account. Its users.id is deliberately set to the
          // SAME uuid as students.id — every STUDENT-scoped query elsewhere (attendance,
          // fees, leave requests, session calendar) resolves "my own data" by treating
          // req.user.id as the student_id directly, so the two ids must stay identical.
          const existingUser = await query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
            [email]
          );

          if (existingUser.rows.length > 0 && existingUser.rows[0].id !== student.id) {
            console.warn(
              `[CreateStudent] Email ${email} is already tied to a different user account (${existingUser.rows[0].id}). Skipping login creation for student ${student.id}.`
            );
            return;
          }

          if (existingUser.rows.length === 0) {
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const passwordHash = await hashPassword(randomPassword);
            await query(
              `INSERT INTO users (id, username, password_hash, role, name, email, center_id, created_at, last_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [student.id, email, passwordHash, UserRole.STUDENT, fullName, email, req.tenantCenterId]
            );
          }

          const studentUserId = student.id;

          await query(
            `INSERT INTO user_center_memberships (user_id, center_id, role)
             VALUES ($1, $2, 'STUDENT')
             ON CONFLICT (user_id, center_id, role) DO NOTHING`,
            [studentUserId, req.tenantCenterId]
          );

          // Generate a 24-hour password-set token
          const rawToken = generateResetToken();
          const tokenHash = hashToken(rawToken);
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

          await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [studentUserId]);
          await query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [studentUserId, tokenHash, expiresAt.toISOString()]
          );

          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
          const loginUrl = `${frontendUrl}/login`;

          sendStudentWelcomeEmail({
            studentEmail: email,
            studentName: fullName,
            studentUsername: email,
            resetLink,
            loginUrl,
            centerName,
            batchName,
            centerContactInfo,
            guardianName: guardianName || undefined,
            isMinor,
            centerId: req.tenantCenterId,
          });
        } catch (emailError) {
          console.error(`[CreateStudent] Failed to create login account / send welcome email:`, emailError);
        }
      });
    }
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
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { batch, coach, search, asOfDate, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause based on role and filters
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Exclude archived students by default
    conditions.push("status != 'archived'");

    // Tenant scoping: filter by center_id if set
    if (req.tenantCenterId) {
      conditions.push(`center_id = $${paramIndex}`);
      params.push(req.tenantCenterId);
      paramIndex++;
    }

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

    // asOfDate: only students whose active enrollment has actually started by this date —
    // used by the dashboard's "Today's Attendance" widget so a student assigned to a batch
    // whose training hasn't begun yet doesn't show up before their coverage starts.
    if (asOfDate && typeof asOfDate === 'string') {
      conditions.push(
        `EXISTS (
          SELECT 1 FROM student_enrollments e
          WHERE e.student_id = students.id AND e.status = 'active' AND e.start_date <= $${paramIndex}
        )`
      );
      params.push(asOfDate);
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
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Students may only fetch their own record (their users.id === students.id)
    if (req.user.role === UserRole.STUDENT && id !== req.user.id) {
      res.status(403).json({
        error: 'You do not have permission to access this student',
      });
      return;
    }

    // Build WHERE clause with tenant scoping
    const conditions: string[] = ['s.id = $1'];
    const params: any[] = [id];

    if (req.tenantCenterId) {
      conditions.push('s.center_id = $2');
      params.push(req.tenantCenterId);
    }

    // Fetch student, enriched with batch name and assigned coach details
    const result = await query(
      `SELECT
        s.id, s.full_name, s.date_of_birth, s.age, s.gender, s.contact_phone, s.email,
        s.guardian_name, s.guardian_phone, s.baid_number, s.batch_id, s.assigned_coach_id,
        s.profile_photo, s.height, s.weight, s.bmi, s.blood_group, s.medical_conditions,
        s.emergency_contact, s.strengths, s.weaknesses, s.coach_feedback, s.skill_level,
        s.created_at, s.updated_at,
        b.name AS batch_name,
        c.name AS assigned_coach_name,
        c.profile_photo AS assigned_coach_photo
      FROM students s
      LEFT JOIN batches b ON b.id = s.batch_id
      LEFT JOIN users c ON c.id = s.assigned_coach_id
      WHERE ${conditions.join(' AND ')}`,
      params
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
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // First check if student exists and get current data
    const existingConditions: string[] = ['id = $1'];
    const existingParams: any[] = [id];

    if (req.tenantCenterId) {
      existingConditions.push('center_id = $2');
      existingParams.push(req.tenantCenterId);
    }

    const existingResult = await query(
      `SELECT id, assigned_coach_id, batch_id FROM students WHERE ${existingConditions.join(' AND ')}`,
      existingParams
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

    // Archive permission check: only HEAD_COACH can archive students
    if (req.body.status === 'archived' && req.user.role !== UserRole.HEAD_COACH) {
      res.status(403).json({
        error: 'Only head coaches can archive students',
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
      status: 'status',
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

    // When archiving, also set archived_at timestamp
    if (req.body.status === 'archived') {
      updates.push(`archived_at = NOW()`);
    }

    // Add student ID as last parameter
    params.push(id);

    // Build WHERE clause with tenant scoping
    const whereConditions = [`id = $${paramIndex}`];
    paramIndex++;

    if (req.tenantCenterId) {
      whereConditions.push(`center_id = $${paramIndex}`);
      params.push(req.tenantCenterId);
      paramIndex++;
    }

    // Execute update
    const result = await query(
      `UPDATE students
      SET ${updates.join(', ')}
      WHERE ${whereConditions.join(' AND ')}
      RETURNING 
        id, full_name, date_of_birth, age, gender, contact_phone, email,
        guardian_name, guardian_phone, baid_number, batch_id, assigned_coach_id,
        profile_photo, height, weight, bmi, blood_group, medical_conditions,
        emergency_contact, strengths, weaknesses, coach_feedback, skill_level,
        status, archived_at, created_at, updated_at`,
      params
    );

    const student = mapDatabaseRowToStudent(result.rows[0]);
    res.status(200).json(student);

    // Fire-and-forget: auto-clone curriculum plan if student was moved to a new batch
    const newBatchId = req.body.batchId as string | undefined;
    const oldBatchId = existingStudent.batch_id;
    if (newBatchId && newBatchId !== oldBatchId) {
      const studentId = id as string;
      setImmediate(async () => {
        try {
          await autoCloneStudentPlan(studentId, newBatchId, req.tenantCenterId || null);
        } catch (err) {
          console.error('[UpdateStudent] Auto-clone curriculum plan failed:', err);
        }
      });
    }

    // Fire-and-forget: keep the coach recorded as assigned to the student's (possibly
    // just-updated) batch — uses the row's own effective values, not just what this
    // particular PATCH touched, so setting only one of the two still checks out right.
    if (student.batchId && student.assignedCoachId) {
      setImmediate(async () => {
        try {
          await ensureCoachAssignedToBatch(student.batchId!, student.assignedCoachId!);
        } catch (err) {
          console.error('[UpdateStudent] Failed to ensure coach-batch assignment:', err);
        }
      });
    }
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
    status: row.status,
    archivedAt: row.archived_at,
    ...(row.batch_name !== undefined && { batchName: row.batch_name }),
    ...(row.assigned_coach_name !== undefined && { assignedCoachName: row.assigned_coach_name }),
    ...(row.assigned_coach_photo !== undefined && { assignedCoachPhoto: row.assigned_coach_photo }),
  };
}
