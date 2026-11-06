
import "dotenv/config";

import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";
import bookingRoutes from "./routes/booking.routes.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "OK",
      message: "TutorHub API is running",
      database: "Connected",
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(503).json({
      status: "ERROR",
      message: "Database connection failed",
    });
  }
});

// Booking routes
app.use("/api/bookings", bookingRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`TutorHub API running at http://localhost:${PORT}`);
});
