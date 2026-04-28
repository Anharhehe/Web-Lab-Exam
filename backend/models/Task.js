const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Title is required'],
      trim:      true,
      minlength: [5,  'Title must be at least 5 characters'],
      maxlength: [80, 'Title cannot exceed 80 characters']
    },
    description: {
      type:      String,
      required:  [true, 'Description is required'],
      trim:      true,
      maxlength: [200, 'Description cannot exceed 200 characters']
    },
    priority: {
      type:    String,
      enum:    ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    status: {
      type:    String,
      enum:    ['pending', 'active', 'completed'],
      default: 'pending'
    },
    zone: {
      type: String,
      trim: true
    },
    assignedTo: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Volunteer',
      default: null
    },
    completedAt: {
      type:    Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', TaskSchema);
