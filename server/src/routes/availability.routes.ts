
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  AvailabilityError,
  createAvailability,
  deleteAvailability,
  getTutorAvailability,
  updateAvailability,
} from '../services/availability.service.js';
import {
  authenticate,
  requireRole,
} from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireRole('TUTOR'));

const availabilitySchema = z.object({
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
});

function getUserId(res: Response): number | null {
  const user = res.locals.user as { id: number } | undefined;
  return user?.id ?? null;
}

function handleError(
  res: Response,
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof AvailabilityError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ message: fallbackMessage });
}

// POST /api/tutor/availability
router.post('/', async (req: Request, res: Response) => {
  const parsed = availabilitySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid availability details.' });
    return;
  }

  const tutorId = getUserId(res);

  if (tutorId === null) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  try {
    const availability = await createAvailability(tutorId, {
      startTime: new Date(parsed.data.startTime),
      endTime: new Date(parsed.data.endTime),
    });

    res.status(201).json(availability);
  } catch (error) {
    handleError(res, error, 'Unable to create availability.');
  }
});

// PUT /api/tutor/availability/:id
router.put('/:id', async (req: Request, res: Response) => {
  const availabilityId = Number(req.params.id);

  if (!Number.isInteger(availabilityId) || availabilityId <= 0) {
    res.status(400).json({ message: 'Invalid availability ID.' });
    return;
  }

  const parsed = availabilitySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid availability details.' });
    return;
  }

  const tutorId = getUserId(res);

  if (tutorId === null) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  try {
    const availability = await updateAvailability(tutorId, availabilityId, {
      startTime: new Date(parsed.data.startTime),
      endTime: new Date(parsed.data.endTime),
    });

    res.status(200).json(availability);
  } catch (error) {
    handleError(res, error, 'Unable to update availability.');
  }
});

// DELETE /api/tutor/availability/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const availabilityId = Number(req.params.id);

  if (!Number.isInteger(availabilityId) || availabilityId <= 0) {
    res.status(400).json({ message: 'Invalid availability ID.' });
    return;
  }

  const tutorId = getUserId(res);

  if (tutorId === null) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  try {
    const result = await deleteAvailability(tutorId, availabilityId);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, 'Unable to remove availability.');
  }
});

// GET /api/tutor/availability
router.get('/', async (_req: Request, res: Response) => {
  const tutorId = getUserId(res);

  if (tutorId === null) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  try {
    const result = await getTutorAvailability(tutorId);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, 'Unable to get tutor availability.');
  }
});

export default router;
