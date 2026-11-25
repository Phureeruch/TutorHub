import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getAdminSummary,
  getPendingTutors,
  approveTutor,
  createSubject,
  updateSubject,
} from '../services/admin.service.js';
import { validateSubjectInput } from '../utils/admin-validation.js';

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

// GET /api/admin/tutors/pending
router.get('/tutors/pending', async (_req: Request, res: Response) => {
  try {
    const tutors = await getPendingTutors();
    res.status(200).json(tutors);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Unable to get pending tutors.',
    });
  }
});

// PATCH /api/admin/tutors/:id/approve
router.patch('/tutors/:id/approve', async (req: Request, res: Response) => {
  const tutorId = Number(req.params.id);
  if (!Number.isInteger(tutorId) || tutorId <= 0) {
    res.status(400).json({ message: 'Invalid tutor ID.' });
    return;
  }

  try {
    const user = await approveTutor(tutorId);
    if (!user) {
      res.status(404).json({ message: 'Tutor account not found.' });
      return;
    }

    res.status(200).json({
      message: 'Tutor approved successfully.',
      isApproved: true,
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Unable to approve tutor.',
    });
  }
});

// POST /api/admin/subjects
router.post('/subjects', async (req: Request, res: Response) => {
  const validation = validateSubjectInput(req.body ?? {});
  if (!validation.valid) {
    res.status(400).json({ message: validation.reason });
    return;
  }

  try {
    const result = await createSubject(validation.data);
    if (result.duplicate) {
      res.status(409).json({ message: 'A subject with this name already exists.' });
      return;
    }

    res.status(201).json(result.subject);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Unable to create subject.',
    });
  }
});

// PUT /api/admin/subjects/:id
router.put('/subjects/:id', async (req: Request, res: Response) => {
  const subjectId = Number(req.params.id);
  if (!Number.isInteger(subjectId) || subjectId <= 0) {
    res.status(400).json({ message: 'Invalid subject ID.' });
    return;
  }

  const validation = validateSubjectInput(req.body ?? {});
  if (!validation.valid) {
    res.status(400).json({ message: validation.reason });
    return;
  }

  try {
    const result = await updateSubject(subjectId, validation.data);
    if (result.notFound) {
      res.status(404).json({ message: 'Subject not found.' });
      return;
    }
    if (result.duplicate) {
      res.status(409).json({ message: 'A subject with this name already exists.' });
      return;
    }

    res.status(200).json(result.subject);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Unable to update subject.',
    });
  }
});

export default router;
