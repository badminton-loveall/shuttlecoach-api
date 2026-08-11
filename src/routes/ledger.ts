import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { tenantScope } from '../middleware/tenantScope';
import { requireFeeAccess } from '../middleware/feeAccess';
import { validateRequest, validateQuery } from '../middleware/validation';
import { ledgerQuerySchema, manualEntrySchema } from '../validators/ledger.schemas';
import { getLedger, createManualLedgerEntry } from '../controllers/ledger';
import { UserRole } from '../types';

const router = Router();

// All ledger routes require authentication, tenant scoping, and fee access
router.use(authenticate);
router.use(tenantScope);
router.use(requireFeeAccess);

/**
 * GET /api/ledger
 * Query ledger entries with optional time and person filters.
 * Returns entries with running balance and summary totals.
 */
router.get('/', validateQuery(ledgerQuerySchema), getLedger);

/**
 * POST /api/ledger/entries
 * Create a manual ledger entry (miscellaneous income/expense).
 * Restricted to HEAD_COACH role.
 */
router.post(
  '/entries',
  authorize(UserRole.HEAD_COACH),
  validateRequest(manualEntrySchema),
  createManualLedgerEntry
);

export default router;
