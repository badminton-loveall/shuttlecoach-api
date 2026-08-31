import { Router } from 'express';
import { generateMonthlyFeesCron } from '../controllers/cron';

const router = Router();

// No auth/tenant middleware — Vercel Cron requests carry no user session. Authorization is
// instead a shared-secret check inside the controller (CRON_SECRET).
router.get('/generate-monthly-fees', generateMonthlyFeesCron);

export default router;
