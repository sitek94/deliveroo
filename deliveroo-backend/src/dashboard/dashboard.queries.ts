import pool from '../database'

/**
 * Calculates on-time delivery percentage for completed deliveries in date range
 */
export async function getOnTimeRate(startDate: Date, endDate: Date) {
  const result = await pool.query(
    /* sql */ `
    -- Uses boolean-to-int conversion: TRUE becomes 1, FALSE becomes 0
    SELECT AVG((actual_delivery_time <= scheduled_delivery_time)::INT) * 100.0 AS on_time_percentage
    FROM deliveries
    WHERE status = 'completed'
      AND actual_delivery_time IS NOT NULL
      AND created_at >= $1
      AND created_at < $2;
  `,
    [startDate.toISOString(), endDate.toISOString()],
  )

  // Handle cases where COUNT(*) is 0 to avoid division by zero, returning null or 0 as appropriate
  if (result.rows[0].on_time_percentage === null) {
    return 0
  }
  return Number(result.rows[0].on_time_percentage)
}

/**
 * Calculates the average fuel efficiency (MPG) for a given time period.
 */
export async function getFuelEfficiency(startDate: Date, endDate: Date) {
  const result = await pool.query(
    `
    SELECT AVG(delivery_distance_miles / NULLIF(fuel_consumed_gallons, 0)) AS average_mpg
    FROM deliveries
    WHERE status = 'completed'
      AND fuel_consumed_gallons > 0
      AND delivery_distance_miles > 0
      AND created_at >= $1
      AND created_at < $2;
  `,
    [startDate.toISOString(), endDate.toISOString()],
  )

  // Handle cases where AVG is null (no relevant deliveries), returning 0 or null
  if (result.rows[0].average_mpg === null) {
    return 0
  }
  return Number(result.rows[0].average_mpg)
}

/**
 * Returns the total number of completed deliveries for a given time period.
 */
export async function getTotalCompletedDeliveries(startDate: Date, endDate: Date) {
  const result = await pool.query(
    `
    SELECT COUNT(*) AS total_completed
    FROM deliveries
    WHERE status = 'completed'
      AND created_at >= $1
      AND created_at < $2;
  `,
    [startDate.toISOString(), endDate.toISOString()],
  )
  return Number(result.rows[0].total_completed) || 0
}

/**
 * Returns the average delivery duration (in minutes) for completed deliveries in a given time period.
 * Uses actual_pickup_time if available, otherwise falls back to created_at as the start time.
 */
export async function getAverageDeliveryDurationInMinutes(startDate: Date, endDate: Date) {
  const result = await pool.query(
    `
    SELECT AVG(EXTRACT(EPOCH FROM (actual_delivery_time - COALESCE(actual_pickup_time, created_at))) / 60.0) AS avg_duration_minutes
    FROM deliveries
    WHERE status = 'completed'
      AND actual_delivery_time IS NOT NULL
      AND (actual_pickup_time IS NOT NULL OR created_at IS NOT NULL)
      AND created_at >= $1
      AND created_at < $2;
  `,
    [startDate.toISOString(), endDate.toISOString()],
  )
  if (result.rows[0].avg_duration_minutes === null) {
    return 0
  }
  return Number(result.rows[0].avg_duration_minutes)
}
