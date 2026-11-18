
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  getSubjects,
  getApprovedTutors,
  listTutorDirectory,
} from '../services/discovery.service.js';

const router = Router();

const teachingLevels = [
  'HIGH_SCHOOL',
  'UNDERGRADUATE',
  'GRADUATE',
] as const;

const discoveryQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  tutorId: z.coerce.number().int().positive().optional(),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  level: z.enum(teachingLevels).optional(),
});

function isValidCalendarDate(date: string): boolean {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month! - 1 &&
    parsed.getUTCDate() === day
  );
}

// GET /api/subjects
router.get('/subjects', async (_req: Request, res: Response) => {
  try {
    const subjects = await getSubjects();
    res.status(200).json(subjects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to get subjects.' });
  }
});

// GET /api/tutors
router.get('/tutors', async (_req: Request, res: Response) => {
  try {
    const tutors = await getApprovedTutors();
    res.status(200).json(tutors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to get tutors.' });
  }
});

// GET /api/availability
router.get('/availability', async (req: Request, res: Response) => {
  const parsed = discoveryQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid discovery filters.' });
    return;
  }

  if (
    parsed.data.date !== undefined &&
    !isValidCalendarDate(parsed.data.date)
  ) {
    res.status(400).json({ message: 'Invalid date.' });
    return;
  }

  try {
   const tutors = await listTutorDirectory({
  ...(parsed.data.subjectId !== undefined
    ? { subjectId: parsed.data.subjectId }
    : {}),
  ...(parsed.data.tutorId !== undefined
    ? { tutorId: parsed.data.tutorId }
    : {}),
  ...(parsed.data.date !== undefined
    ? { date: parsed.data.date }
    : {}),
  ...(parsed.data.level !== undefined
    ? { level: parsed.data.level }
    : {}),
});
    res.status(200).json(tutors);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Unable to search tutor availability.',
    });
  }
});

export default router;
