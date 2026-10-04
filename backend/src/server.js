const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const { pool } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3008', 'http://localhost:5173', 'http://localhost:8081', 'http://localhost:19006'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rate Limiting for auth routes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'คำขอมากเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' },
  skip: (req) => process.env.NODE_ENV === 'test' || process.env.CI || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/login', loginLimiter);

// PostgreSQL pool error handler — prevent unhandled crash
pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL pool error:', err.message);
});

// Routes
app.use('/api', apiRoutes);
app.use('/api/v1', apiRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to WellX989 API Service' });
});

// 404 Handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err.stack || err.message);
  res.status(500).json({
    success: false,
    message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful Shutdown Handlers (Production & Container Lifecycle)
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);
  server.close(async () => {
    console.log('  🔒 All active HTTP connections closed.');
    try {
      await pool.end();
      console.log('  🐘 PostgreSQL connection pool closed cleanly.');
    } catch (e) {
      console.error('  ❌ Error while closing PostgreSQL pool:', e.message);
    }
    console.log('  👋 Server process terminated gracefully.');
    process.exit(0);
  });

  // Force exit after 10s if connections refuse to terminate
  setTimeout(() => {
    console.error('  ⚠️ Forcing server shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
