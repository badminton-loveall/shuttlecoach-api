import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { UserRole } from '../types';
import {
  createRequest,
  getPendingRequests,
  getPendingCount,
  approveRequest,
  rejectRequest,
  hasPendingRequestForCenter,
} from '../services/slugChangeRequestService';

/**
 * Routes for HEAD_COACH slug change request submission.
 * Mounted at /api/slug-change-requests
 */
export const slugChangeRequestRouter = Router();

slugChangeRequestRouter.use(authenticate);

/**
 * GET /api/slug-change-requests/pending
 * HEAD_COACH checks if their center already has a pending slug change request.
 */
slugChangeRequestRouter.get(
  '/pending',
  authorize(UserRole.HEAD_COACH),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const centerId = req.user!.centerId;
      if (!centerId) {
        res.json({ hasPending: false });
        return;
      }
      const hasPending = await hasPendingRequestForCenter(centerId);
      res.json({ hasPending });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to check pending status' });
    }
  }
);

/**
 * POST /api/slug-change-requests
 * HEAD_COACH submits a slug change request for their center.
 */
slugChangeRequestRouter.post(
  '/',
  authorize(UserRole.HEAD_COACH),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const centerId = req.user!.centerId;
      const { requestedSlug } = req.body;

      if (!centerId) {
        res.status(400).json({ error: 'No center associated with your account' });
        return;
      }

      if (!requestedSlug) {
        res.status(400).json({ error: 'requestedSlug is required' });
        return;
      }

      const request = await createRequest(centerId, requestedSlug, req.user!.id);
      res.status(201).json(request);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message || 'Failed to create slug change request' });
    }
  }
);

/**
 * Routes for ADMIN slug change request management.
 * Mounted at /api/admin/slug-change-requests
 */
export const adminSlugChangeRequestRouter = Router();

adminSlugChangeRequestRouter.use(authenticate);
adminSlugChangeRequestRouter.use(authorize(UserRole.ADMIN));

/**
 * GET /api/admin/slug-change-requests
 * Lists all pending slug change requests.
 */
adminSlugChangeRequestRouter.get(
  '/',
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const requests = await getPendingRequests();
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve slug change requests' });
    }
  }
);

/**
 * GET /api/admin/slug-change-requests/count
 * Returns the count of pending slug change requests.
 */
adminSlugChangeRequestRouter.get(
  '/count',
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const count = await getPendingCount();
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve pending count' });
    }
  }
);

/**
 * PATCH /api/admin/slug-change-requests/:id
 * Approves or rejects a pending slug change request.
 * Body: { action: 'approve' | 'reject' }
 */
adminSlugChangeRequestRouter.patch(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { action } = req.body;

      if (!action || !['approve', 'reject'].includes(action)) {
        res.status(400).json({ error: "action must be 'approve' or 'reject'" });
        return;
      }

      let result;
      if (action === 'approve') {
        result = await approveRequest(id, req.user!.id);
      } else {
        result = await rejectRequest(id, req.user!.id);
      }

      res.json(result);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message || 'Failed to process slug change request' });
    }
  }
);
