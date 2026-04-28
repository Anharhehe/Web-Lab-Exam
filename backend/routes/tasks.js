const express    = require('express');
const router     = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Task       = require('../models/Task');
const Volunteer  = require('../models/Volunteer');

/* ── validation helper ─────────────────────────────────────────── */
function hasErrors(req, res) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    res.status(422).json({ errors: result.array() });
    return true;
  }
  return false;
}

/* ── GET /api/tasks ─────────────────────────────────────────────── */
router.get(
  '/',
  [
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('priority must be low | medium | high | critical')
  ],
  async (req, res) => {
    if (hasErrors(req, res)) return;
    try {
      const filter = {};
      if (req.query.priority) filter.priority = req.query.priority;

      const tasks = await Task.find(filter)
        .populate('assignedTo', 'name role availability')
        .sort({ createdAt: -1 });

      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ── POST /api/tasks ────────────────────────────────────────────── */
router.post(
  '/',
  [
    body('title')
      .trim()
      .isLength({ min: 5, max: 80 })
      .withMessage('Title must be 5–80 characters'),
    body('description')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Description must be 1–200 characters'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid priority value'),
    body('zone')
      .optional()
      .trim()
  ],
  async (req, res) => {
    if (hasErrors(req, res)) return;
    try {
      const task = await Task.create(req.body);
      res.status(201).json(task);
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(422).json({
          errors: Object.values(err.errors).map(e => ({ msg: e.message, path: e.path }))
        });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

/* ── PATCH /api/tasks/:id/status  (one step forward only) ───────── */
const STATUS_NEXT = { pending: 'active', active: 'completed' };

router.patch(
  '/:id/status',
  [param('id').isMongoId().withMessage('Invalid task ID')],
  async (req, res) => {
    if (hasErrors(req, res)) return;
    try {
      const task = await Task.findById(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      if (task.status === 'completed') {
        return res.status(400).json({ error: 'Task is already completed — cannot advance further' });
      }

      task.status = STATUS_NEXT[task.status];
      if (task.status === 'completed') {
        task.completedAt = new Date();
        // Free the assigned volunteer
        if (task.assignedTo) {
          await Volunteer.findByIdAndUpdate(task.assignedTo, {
            availability: 'available',
            assignedTask: null
          });
        }
      }

      await task.save();
      await task.populate('assignedTo', 'name role availability');
      res.json(task);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ── DELETE /api/tasks/:id ──────────────────────────────────────── */
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid task ID')],
  async (req, res) => {
    if (hasErrors(req, res)) return;
    try {
      const task = await Task.findByIdAndDelete(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      // Free the assigned volunteer if any
      if (task.assignedTo) {
        await Volunteer.findByIdAndUpdate(task.assignedTo, {
          availability: 'available',
          assignedTask: null
        });
      }

      res.json({ message: 'Task deleted', id: task._id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ── POST /api/tasks/:id/assign ─────────────────────────────────── */
router.post(
  '/:id/assign',
  [
    param('id')
      .isMongoId().withMessage('Invalid task ID'),
    body('volunteerId')
      .isMongoId().withMessage('volunteerId must be a valid Mongo ObjectId')
  ],
  async (req, res) => {
    if (hasErrors(req, res)) return;
    try {
      const task = await Task.findById(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      if (task.status === 'completed') {
        return res.status(400).json({ error: 'Cannot assign a volunteer to a completed task' });
      }

      const volunteer = await Volunteer.findById(req.body.volunteerId);
      if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });

      if (volunteer.availability !== 'available') {
        return res.status(409).json({
          error: `${volunteer.name} is not available (current status: ${volunteer.availability})`
        });
      }

      // If task is already assigned to someone else, free that volunteer first
      if (task.assignedTo && !task.assignedTo.equals(volunteer._id)) {
        await Volunteer.findByIdAndUpdate(task.assignedTo, {
          availability: 'available',
          assignedTask: null
        });
      }

      // Assign
      task.assignedTo = volunteer._id;
      await task.save();

      volunteer.availability = 'on_task';
      volunteer.assignedTask = task._id;
      await volunteer.save();

      await task.populate('assignedTo', 'name role availability');
      res.json(task);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
