require('dotenv').config();
const mongoose  = require('mongoose');
const Task      = require('./models/Task');
const Volunteer = require('./models/Volunteer');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB...');

    /* ── 1. Clear both collections ─────────────────────────────── */
    await Task.deleteMany({});
    await Volunteer.deleteMany({});
    console.log('Collections cleared.');

    /* ── 2. Insert 3 volunteers (initially available) ──────────── */
    const [sara, john, alex] = await Volunteer.insertMany([
      {
        name:         'Sara M.',
        email:        'sara.m@relief.org',
        role:         'Medical Coordinator',
        availability: 'available'
      },
      {
        name:         'John D.',
        email:        'john.d@relief.org',
        role:         'Infrastructure Lead',
        availability: 'available'
      },
      {
        name:         'Alex K.',
        email:        'alex.k@relief.org',
        role:         'Logistics Coordinator',
        availability: 'available'
      }
    ]);

    /* ── 3. Insert 3 tasks — Shelter Infrastructure Zone B ─────── */
    const [t1, t2, t3] = await Task.insertMany([
      {
        title:       'Zone B – Medical Station Setup',
        description: 'Establish a fully operational medical station in Shelter Zone B including first-aid supplies and triage area.',
        priority:    'high',
        status:      'active',
        zone:        'Shelter Infrastructure Zone B',
        assignedTo:  sara._id
      },
      {
        title:       'Zone B – Power Infrastructure',
        description: 'Install temporary generator and electrical distribution network for all Shelter Zone B facilities.',
        priority:    'critical',
        status:      'active',
        zone:        'Shelter Infrastructure Zone B',
        assignedTo:  john._id
      },
      {
        title:       'Zone B – Supply Distribution Hub',
        description: 'Organise and manage the central supply distribution hub serving all Zone B shelter occupants.',
        priority:    'medium',
        status:      'active',
        zone:        'Shelter Infrastructure Zone B',
        assignedTo:  alex._id
      }
    ]);

    /* ── 4. Update volunteers: on_task + link assignedTask ─────── */
    await Volunteer.findByIdAndUpdate(sara._id, { availability: 'on_task', assignedTask: t1._id });
    await Volunteer.findByIdAndUpdate(john._id, { availability: 'on_task', assignedTask: t2._id });
    await Volunteer.findByIdAndUpdate(alex._id, { availability: 'on_task', assignedTask: t3._id });

    /* ── 5. Report ─────────────────────────────────────────────── */
    console.log('Seeded successfully');
    console.log('  ✅  3 tasks inserted — all tagged Shelter Infrastructure Zone B');
    console.log('  ✅  3 volunteers inserted and assigned');
    console.log('  ✅  Sara M. availability → on_task');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seed();
