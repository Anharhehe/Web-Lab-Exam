const express   = require('express');
const router    = express.Router();
const { body, validationResult } = require('express-validator');
const Volunteer = require('../models/Volunteer');

/* ── validation helper ─────────────────────────────────────────── */
function hasErrors(req, res) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    res.status(422).json({ errors: result.array() });
    return true;
  }
  return false;
}

/* ── GET /api/volunteers ────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const volunteers = await Volunteer.find()
      .populate('assignedTask', 'title priority status zone')
      .sort({ createdAt: -1 });
    res.json(volunteers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/volunteers ───────────────────────────────────────── */
router.post(
  '/',
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 60 })
      .withMessage('Name must be 2–60 characters'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email address required')
      .toLowerCase(),
    body('role')
      .trim()
      .isLength({ min: 2, max: 60 })
      .withMessage('Role must be 2–60 characters'),
    body('availability')
      .optional()
      .isIn(['available', 'on_task', 'unavailable'])
      .withMessage('availability must be available | on_task | unavailable')
  ],
  async (req, res) => {
    if (hasErrors(req, res)) return;
    try {
      const volunteer = await Volunteer.create(req.body);
      res.status(201).json(volunteer);
    } catch (err) {
      // Duplicate email (unique index violation)
      if (err.code === 11000) {
        return res.status(409).json({ error: 'A volunteer with this email already exists' });
      }
      if (err.name === 'ValidationError') {
        return res.status(422).json({
          errors: Object.values(err.errors).map(e => ({ msg: e.message, path: e.path }))
        });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
