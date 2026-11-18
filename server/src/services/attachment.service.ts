import { randomUUID } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedUser } from '../middleware/auth.js';

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENT_MB = MAX_ATTACHMENT_BYTES / (1024 * 1024);

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const EXTENSION_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export interface AttachmentMetadataInput {
  name: string;
  size: number;
  type: string;
}

export class AttachmentError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AttachmentError';
  }
}

export function getUploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || 'uploads');
}

export function resolveMimeType(fileName: string, mimeType: string): string | null {
  const normalized = mimeType.trim().toLowerCase().split(';')[0] ?? '';
  if (ALLOWED_MIME_TYPES.has(normalized)) {
    return normalized;
  }
  if (!normalized || normalized === 'application/octet-stream') {
    const ext = path.extname(fileName.trim().toLowerCase());
    return EXTENSION_MIME_MAP[ext] ?? null;
  }
  return null;
}

export function validateSingleAttachment(input: AttachmentMetadataInput): {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
} {
  const fileName = path.basename(input.name.trim());
  if (!fileName) {
    throw new AttachmentError(400, 'Each file needs a name.');
  }

  if (!Number.isInteger(input.size) || input.size <= 0) {
    throw new AttachmentError(400, `${fileName} must not be empty.`);
  }

  if (input.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentError(400, `${fileName} is larger than ${MAX_ATTACHMENT_MB} MB.`);
  }

  const mimeType = resolveMimeType(fileName, input.type);
  if (!mimeType) {
    throw new AttachmentError(400, `${fileName}: unsupported file type.`);
  }

  return { fileName, sizeBytes: input.size, mimeType };
}

export function validateAttachmentList(files: AttachmentMetadataInput[]) {
  if (files.length > MAX_ATTACHMENTS) {
    throw new AttachmentError(400, `Attach at most ${MAX_ATTACHMENTS} files.`);
  }
  return files.map(validateSingleAttachment);
}

export async function createAttachmentUpload(
  studentId: number,
  input: AttachmentMetadataInput & { content?: Buffer },
) {
  const validated = validateSingleAttachment(input);
  const storageKey = randomUUID();

  const created = await prisma.bookingAttachment.create({
    data: {
      bookingId: null,
      uploadedById: studentId,
      fileName: validated.fileName,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
      storageKey,
      fileData: input.content ? Uint8Array.from(input.content) : null,
    },
    select: {
      id: true,
      fileName: true,
      sizeBytes: true,
      mimeType: true,
    },
  });

  return {
    id: created.id,
    name: created.fileName,
    size: created.sizeBytes,
    type: created.mimeType,
  };
}

export async function getAttachmentForUser(
  user: AuthenticatedUser,
  attachmentId: number,
) {
  const attachment = await prisma.bookingAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      booking: {
        select: {
          studentId: true,
          tutorId: true,
        },
      },
    },
  });

  if (!attachment) {
    throw new AttachmentError(404, 'Attachment not found.');
  }

  const allowed =
    user.role === 'ADMIN' ||
    attachment.uploadedById === user.id ||
    (attachment.booking !== null &&
      (attachment.booking.studentId === user.id ||
        attachment.booking.tutorId === user.id));

  if (!allowed) {
    throw new AttachmentError(403, 'You are not allowed to access this attachment.');
  }

  let fileBuffer: Buffer | null = attachment.fileData ? Buffer.from(attachment.fileData) : null;

  // Fallback to local filesystem if file was stored previously on disk before migration
  if (!fileBuffer) {
    const candidatePath = path.join(getUploadDir(), path.basename(attachment.storageKey));
    try {
      await access(candidatePath);
      fileBuffer = await readFile(candidatePath);
    } catch {
      fileBuffer = null;
    }
  }

  return {
    attachment: {
      id: attachment.id,
      name: attachment.fileName,
      size: attachment.sizeBytes,
      type: attachment.mimeType,
    },
    fileBuffer,
  };
}
