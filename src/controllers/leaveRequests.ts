import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserRole } from '../types';
import {
  createLeaveRequest,
  getLeaveRequests,
  reviewLeaveRequest,
} from '../services/leaveRequests';

/**
 * POST /api/leave-requests
 * Create a new leave request.
 * - All authenticated users can create leave requests.
 * - STUDENT role is restricted to creating requests for themselves only.
 * - Coaches (HEAD_COACH, ASSISTANT_COACH) can create requests for any student.
 *
 * Validates:
 * - leaveType must be PLANNED_LEAVE or SICK_LEAVE (enforced by schema)
 * - requestedDate must be strictly in the future (enforced by service)
 *
 * Requirements: 11.4
 */
export const createLeaveRequestHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { studentId, batchId, requestedDate, leaveType, reason } = req.body;

    // STUDENT role: enforce studentId matches their own user-linked student
    if (req.user.role === UserRole.STUDENT) {
      if (studentId !== req.user.id) {
        res.status(403).json({
          error: 'Students can only create leave requests for themselves',
        });
        return;
      }
    }

    const result = await createLeaveRequest({
      studentId,
      batchId,
      requestedDate,
      leaveType,
      reason,
    });

    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(201).json(result.leaveRequest);
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({
      error: 'An error occurred while creating leave request',
    });
  }
};

/**
 * GET /api/leave-requests
 * List leave requests with optional filters (batchId, studentId, status).
 * - STUDENT role: scoped to their own requests only.
 * - Coaches: can view all requests or filter as needed.
 *
 * Requirements: 11.4
 */
export const getLeaveRequestsHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { batchId, studentId, status } = req.query as {
      batchId?: string;
      studentId?: string;
      status?: string;
    };

    // STUDENT role: force scope to their own requests
    const effectiveStudentId =
      req.user.role === UserRole.STUDENT ? req.user.id : studentId;

    const leaveRequests = await getLeaveRequests({
      batchId,
      studentId: effectiveStudentId,
      status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined,
    });

    res.status(200).json(leaveRequests);
  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching leave requests',
    });
  }
};

/**
 * PATCH /api/leave-requests/:id
 * Approve or reject a leave request.
 * - Only HEAD_COACH and ASSISTANT_COACH can review.
 * - Only PENDING requests can be transitioned.
 * - Valid transitions: PENDING -> APPROVED, PENDING -> REJECTED.
 *
 * Requirements: 11.5
 */
export const reviewLeaveRequestHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const idStr = id as string;
    const { status } = req.body as { status: 'APPROVED' | 'REJECTED' };

    const result = await reviewLeaveRequest(idStr, status, req.user.id);

    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(200).json(result.leaveRequest);
  } catch (error) {
    console.error('Review leave request error:', error);
    res.status(500).json({
      error: 'An error occurred while reviewing leave request',
    });
  }
};
