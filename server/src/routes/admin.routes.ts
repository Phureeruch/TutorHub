
import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getAdminSummary } from '../services/admin.service.js';

const router = Router();

// All routes in this file require an authenticated ADMIN.
router.use(authenticate, requireRole('ADMIN'));

// GET /api/admin/summary
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const summary = await getAdminSummary();
    res.status(200).json(summary);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Unable to get admin summary.',
    });
  }
});

export default router;
