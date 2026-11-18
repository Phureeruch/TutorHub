import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, type AuthenticatedUser } from '../middleware/auth.js';
import {
  AttachmentError,
  createAttachmentUpload,
  getAttachmentForUser,
  MAX_ATTACHMENT_MB,
} from '../services/attachment.service.js';

const router = Router();

const metadataSchema = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
});

const rawMultipartParser = express.raw({
  type: 'multipart/form-data',
  limit: `${MAX_ATTACHMENT_MB + 2}mb`,
});

function handleBodyError(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    err.type === 'entity.too.large'
  ) {
    res.status(400).json({
      message: `File is larger than ${MAX_ATTACHMENT_MB} MB.`,
    });
    return;
  }
  next(err);
}

function safeHeaderFilename(fileName: string): string {
  return fileName.replace(/["\\\r\n]/g, '_');
}

router.use(authenticate);

// POST /api/attachments
router.post(
  '/',
  requireRole('STUDENT'),
  rawMultipartParser,
  handleBodyError,
  async (req: Request, res: Response) => {
    const user = res.locals.user as AuthenticatedUser | undefined;
    if (!user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    try {
      const contentType = req.headers['content-type'] ?? '';

      if (contentType.toLowerCase().startsWith('multipart/form-data')) {
        if (!Buffer.isBuffer(req.body)) {
          res.status(400).json({ message: 'Missing uploaded file.' });
          return;
        }

        const parsedForm = await new Response(
          req.body as unknown as BodyInit,
          {
            headers: { 'content-type': contentType },
          },
        ).formData();

        const fileEntry = parsedForm.get('file');
        if (!fileEntry || typeof fileEntry === 'string') {
          res.status(400).json({ message: 'Missing uploaded file.' });
          return;
        }

        const content = Buffer.from(await fileEntry.arrayBuffer());
        const created = await createAttachmentUpload(user.id, {
          name: fileEntry.name,
          size: content.byteLength,
          type: fileEntry.type,
          content,
        });

        res.status(201).json(created);
        return;
      }

      const parsed = metadataSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: 'Invalid attachment details.' });
        return;
      }

      const created = await createAttachmentUpload(user.id, parsed.data);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof AttachmentError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      console.error('Attachment upload failed:', error);
      res.status(500).json({ message: 'Unable to upload attachment.' });
    }
  },
);

// GET /api/attachments/:id
router.get('/:id', async (req: Request, res: Response) => {
  const user = res.locals.user as AuthenticatedUser | undefined;
  if (!user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  const attachmentId = Number(req.params.id);
  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    res.status(404).json({ message: 'Attachment not found.' });
    return;
  }

  try {
    const { attachment, filePath } = await getAttachmentForUser(user, attachmentId);
    if (filePath) {
      res.setHeader('Content-Type', attachment.type);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeHeaderFilename(attachment.name)}"`,
      );
      res.sendFile(filePath);
      return;
    }

    res.status(200).json(attachment);
  } catch (error) {
    if (error instanceof AttachmentError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Attachment retrieval failed:', error);
    res.status(500).json({ message: 'Unable to retrieve attachment.' });
  }
});

export default router;
