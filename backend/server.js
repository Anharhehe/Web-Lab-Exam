require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const mongoose   = require('mongoose');
const getStats   = require('./stats.aggregate');

const tasksRouter      = require('./routes/tasks');
const volunteersRouter = require('./routes/volunteers');

const app = express();

/* ── Middleware ─────────────────────────────────────────────────── */
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

/* ── Routes ─────────────────────────────────────────────────────── */
app.use('/api/tasks',      tasksRouter);
app.use('/api/volunteers', volunteersRouter);

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/* ── 404 catch-all ──────────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

/* ── Global error handler ───────────────────────────────────────── */
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

/* ── Connect + Listen ───────────────────────────────────────────── */
const PORT = parseInt(process.env.PORT, 10) || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅  MongoDB connected — database: 22i2481_Web_Mid');
    app.listen(PORT, () =>
      console.log(`🚀  Server running on http://localhost:${PORT}`)
    );
  })
  .catch(err => {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  });
