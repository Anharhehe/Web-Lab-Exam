const mongoose = require('mongoose');

const VolunteerSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Name is required'],
      trim:      true,
      minlength: [2,  'Name must be at least 2 characters'],
      maxlength: [60, 'Name cannot exceed 60 characters']
    },
    email: {
      type:     String,
      required: [true, 'Email is required'],
      unique:   true,
      trim:     true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    role: {
      type:      String,
      required:  [true, 'Role is required'],
      trim:      true,
      maxlength: [60, 'Role cannot exceed 60 characters']
    },
    availability: {
      type:    String,
      enum:    ['available', 'on_task', 'unavailable'],
      default: 'available'
    },
    assignedTask: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Task',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Volunteer', VolunteerSchema);
