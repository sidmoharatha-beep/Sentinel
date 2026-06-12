require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes         = require('./routes/auth');
const siteRoutes         = require('./routes/sites');
const patrolRoutes       = require('./routes/patrols');
const incidentRoutes     = require('./routes/incidents');
const complianceRoutes   = require('./routes/compliance');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes    = require('./routes/dashboard');

const app  = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',');

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX       || '1000'),
  message:  { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

app.use('/api/auth',          authRoutes);
app.use('/api/sites',         siteRoutes);
app.use('/api/patrols',       patrolRoutes);
app.use('/api/incidents',     incidentRoutes);
app.use('/api/compliance',    complianceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard',     dashboardRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
});

app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));

app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`✅ Sentinel backend v2.0 running on port ${PORT}`);
});

module.exports = app;
