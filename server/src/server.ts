import 'dotenv/config';

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

// Middleware
app.use(cors());
app.use(express.json());

// Health check
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

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/tutor/availability', availabilityRoutes);
app.use('/api', discoveryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/attachments', attachmentRoutes);

// Start server outside test mode so integration tests can bind ephemeral ports cleanly.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`TutorHub API running at http://localhost:${PORT}`);
  });
}

export default app;
