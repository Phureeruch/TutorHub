import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  AuthError,
  getCurrentUser,
  login,
  registerStudent,
  resetPassword,
  verifyEmail,
} from '../services/auth.service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string(),
  password: z.string(),
  name: z.string(),
});

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

const resetPasswordSchema = z.object({
  email: z.string(),
  newPassword: z.string(),
});

function getUserId(res: Response): number | null {
  const user = res.locals.user as { id?: unknown } | undefined;

  return typeof user?.id === 'number' && Number.isInteger(user.id)
    ? user.id
    : null;
}

function handleError(res: Response, error: unknown, fallback: string) {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error(fallback, error);
  res.status(500).json({ message: fallback });
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid registration details.' });
    return;
  }

  try {
    const result = await registerStudent(parsed.data);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Unable to register account.');
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid login details.' });
    return;
  }

  try {
    const result = await login(parsed.data);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, 'Unable to login.');
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', authenticate, async (_req: Request, res: Response) => {
  const userId = getUserId(res);

  if (userId === null) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  try {
    const result = await verifyEmail(userId);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, 'Unable to verify email.');
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid password reset details.' });
    return;
  }

  try {
    const result = await resetPassword(parsed.data);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, 'Unable to reset password.');
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (_req: Request, res: Response) => {
  const userId = getUserId(res);

  if (userId === null) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  try {
    const result = await getCurrentUser(userId);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, 'Unable to retrieve user.');
  }
});

export default router;
