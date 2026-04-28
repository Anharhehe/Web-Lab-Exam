const Task      = require('./models/Task');
const Volunteer = require('./models/Volunteer');

/**
 * Returns a single stats object using:
 *  - One aggregation pipeline ($facet) for task counts
 *  - Volunteer.countDocuments() for totalVolunteers
 */
async function getStats() {
  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const pipeline = [
    {
      $facet: {
        totalActive: [
          { $match: { status: 'active' } },
          { $count: 'count' }
        ],
        totalCritical: [
          { $match: { priority: 'critical' } },
          { $count: 'count' }
        ],
        completedToday: [
          {
            $match: {
              status:      'completed',
              completedAt: { $gte: today, $lt: tomorrow }
            }
          },
          { $count: 'count' }
        ]
      }
    },
    {
      $project: {
        totalActive:    { $ifNull: [{ $arrayElemAt: ['$totalActive.count',    0] }, 0] },
        totalCritical:  { $ifNull: [{ $arrayElemAt: ['$totalCritical.count',  0] }, 0] },
        completedToday: { $ifNull: [{ $arrayElemAt: ['$completedToday.count', 0] }, 0] }
      }
    }
  ];

  const result        = await Task.aggregate(pipeline);
  const taskStats     = result[0] || { totalActive: 0, totalCritical: 0, completedToday: 0 };
  const totalVolunteers = await Volunteer.countDocuments();

  return {
    totalActive:    taskStats.totalActive,
    totalCritical:  taskStats.totalCritical,
    completedToday: taskStats.completedToday,
    totalVolunteers
  };
}

module.exports = getStats;
