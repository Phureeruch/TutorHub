
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export type UserRole = 'STUDENT' | 'TUTOR' | 'ADMIN';

export interface AuthenticatedUser {
  id: number;
  role: UserRole;
}

export const authenticate: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  const token = authorization.slice('Bearer '.length).trim();

  if (!token) {
    res.status(401).json({ message: 'Invalid or expired token.' });
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('JWT_SECRET is not configured.');
    res.status(500).json({ message: 'Internal server error.' });
    return;
  }

  let decoded: string | JwtPayload;

  try {
    decoded = jwt.verify(token, secret);
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
    return;
  }

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.sub !== 'string'
  ) {
    res.status(401).json({ message: 'Invalid or expired token.' });
    return;
  }

  const userId = Number(decoded.sub);

  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(401).json({ message: 'Invalid or expired token.' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    res.status(401).json({ message: 'Invalid or expired token.' });
    return;
  }

  res.locals.user = {
    id: user.id,
    role: user.role,
  } satisfies AuthenticatedUser;

  next();
};

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as AuthenticatedUser | undefined;

    if (!user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ message: 'You are not allowed to perform this action.' });
      return;
    }

    next();
  };
}
