import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma.js';
import bookingRoutes from './routes/booking.routes.js';
import authRoutes from './routes/auth.routes.js';
import availabilityRoutes from './routes/availability.routes.js';
import tutorRoutes from './routes/tutor.routes.js';
import discoveryRoutes from './routes/discovery.routes.js';
import adminRoutes from './routes/admin.routes.js';
import attachmentRoutes from './routes/attachment.routes.js';

export const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());

// Health & Readiness Endpoints
// Preserved legacy endpoint
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'OK',
      message: 'TutorHub API is running',
      database: 'Connected',
    });
  } catch (error) {
    console.error('Database connection failed:', error);

    res.status(503).json({
      status: 'ERROR',
      message: 'Database connection failed',
    });
  }
});

// Standard /api/health for smoke tests
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'TutorHub API',
  });
});

// Standard /api/ready for deployment readiness check
app.get('/api/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'ready',
      db: 'connected',
    });
  } catch (error) {
    console.error('Database readiness check failed:', error);

    res.status(503).json({
      status: 'not_ready',
      db: 'disconnected',
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/tutor/availability', availabilityRoutes);
app.use('/api', discoveryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/attachments', attachmentRoutes);

// In production, serve the built React frontend when available
const clientDistPath = path.resolve(process.env.CLIENT_DIST_DIR || '../client/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Start server outside test mode so integration tests can bind ephemeral ports cleanly.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`TutorHub API running at http://${HOST}:${PORT}`);
  });
}

export default app;
