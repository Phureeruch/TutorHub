
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getTutorProfile,
  TutorError,
  updateTutorProfile,
} from '../services/tutor.service.js';

const router = Router();

const subjectSchema = z.object({
  subjectId: z.number().int().positive(),
  hourlyPrice: z.number(),
  levels: z.array(z.string()).optional().default([]),
  topics: z.string().nullable().optional(),
});

const updateProfileSchema = z.object({
  bio: z.string().optional(),
  subjects: z.array(subjectSchema),
});

function getUserId(res: Response): number | null {
  const user = res.locals.user as { id?: unknown } | undefined;

  return typeof user?.id === 'number' && Number.isInteger(user.id)
    ? user.id
    : null;
}

function handleError(res: Response, error: unknown, fallback: string) {
  if (error instanceof TutorError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error(fallback, error);
  res.status(500).json({ message: fallback });
}

// All tutor routes require authentication and TUTOR role.
router.use(authenticate, requireRole('TUTOR'));

// GET /api/tutor/profile
router.get('/profile', async (_req: Request, res: Response) => {
  const userId = getUserId(res);

  if (userId === null) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  try {
    const profile = await getTutorProfile(userId);
    res.status(200).json(profile);
  } catch (error) {
    handleError(res, error, 'Unable to retrieve tutor profile.');
  }
});

// PUT /api/tutor/profile
router.put('/profile', async (req: Request, res: Response) => {
  const parsed = updateProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid tutor profile details.' });
    return;
  }

  const userId = getUserId(res);

  if (userId === null) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  try {
    const profile = await updateTutorProfile(userId, {
      subjects: parsed.data.subjects.map((subject) => ({
        subjectId: subject.subjectId,
        hourlyPrice: subject.hourlyPrice,
        levels: subject.levels,
        ...(subject.topics !== undefined
          ? { topics: subject.topics }
          : {}),
      })),
      ...(parsed.data.bio !== undefined
        ? { bio: parsed.data.bio }
        : {}),
    });

    res.status(200).json(profile);
  } catch (error) {
    handleError(res, error, 'Unable to update tutor profile.');
  }
});

export default router;