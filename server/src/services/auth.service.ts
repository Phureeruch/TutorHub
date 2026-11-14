
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const SALT_ROUNDS = 12;
const TOKEN_EXPIRES_IN = '8h';

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return secret;
}

function createToken(userId: number, role: string): string {
  return jwt.sign(
    {
      role,
    },
    getJwtSecret(),
    {
      subject: String(userId),
      expiresIn: TOKEN_EXPIRES_IN,
    } satisfies jwt.SignOptions,
  );
}

function toPublicUser(user: {
  id: number;
  email: string;
  name: string;
  role: 'STUDENT' | 'TUTOR' | 'ADMIN';
  isEmailVerified: boolean;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isApproved: user.isApproved,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function registerStudent(input: {
  email: string;
  password: string;
  name: string;
}) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();

  if (!name) {
    throw new AuthError('Name is required.', 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError('Invalid email address.', 400);
  }

  if (input.password.length < 8) {
    throw new AuthError('Password must be at least 8 characters.', 400);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AuthError('Email is already registered.', 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'STUDENT',
        isEmailVerified: false,
        isApproved: false,
      },
      select: { id: true },
    });

    return {
      message: 'Registration successful. Please verify your email.',
      userId: user.id,
    };
  } catch (error) {
    // Also handle duplicate emails created concurrently.
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new AuthError('Email is already registered.', 409);
    }

    throw error;
  }
}

export async function login(input: {
  email: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !(await bcrypt.compare(input.password, user.password))) {
    throw new AuthError('Email or password is incorrect.', 401);
  }

  return {
    token: createToken(user.id, user.role),
    user: toPublicUser(user),
  };
}

export async function verifyEmail(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isEmailVerified: true,
    },
  });

  if (!user) {
    throw new AuthError('User not found.', 404);
  }

  if (user.isEmailVerified) {
    return {
      message: 'Email is already verified.',
      isEmailVerified: true,
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isEmailVerified: true },
  });

  return {
    message: 'Email verified successfully.',
    isEmailVerified: true,
  };
}

export async function resetPassword(input: {
  email: string;
  newPassword: string;
}) {
  if (input.newPassword.length < 8) {
    throw new AuthError('Password must be at least 8 characters.', 400);
  }

  const email = normalizeEmail(input.email);
  const hashedPassword = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

  await prisma.user.updateMany({
    where: { email },
    data: { password: hashedPassword },
  });

  // Always return the same message, even if the email does not exist.
  return {
    message: 'If the account exists, the password has been reset.',
  };
}

export async function getCurrentUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AuthError('User not found.', 404);
  }

  return { user: toPublicUser(user) };
}
