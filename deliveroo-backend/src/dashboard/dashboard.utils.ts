import {subDays, startOfMonth, endOfMonth, subMonths} from 'date-fns'

/**
 * Calculates and returns the date periods for the current full month and the previous full month.
 */
export function getMetricDatePeriods() {
  const now = new Date()

  // Current Period: Full current month
  const currentMonthStart = startOfMonth(now)
  const currentMonthEnd = endOfMonth(now)

  // Previous Period: Full previous month
  const previousMonth = subMonths(now, 1)
  const previousMonthStart = startOfMonth(previousMonth)
  const previousMonthEnd = endOfMonth(previousMonth)

  return {
    currentPeriod: {startDate: currentMonthStart, endDate: currentMonthEnd},
    previousPeriod: {startDate: previousMonthStart, endDate: previousMonthEnd},
  }
}

/**
 * Calculates the percentage change between two values.
 */
export function calculatePercentageChange(currentValue: number, previousValue: number): number {
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : 100
  }
  return ((currentValue - previousValue) / previousValue) * 100
}

/**
 * Determines the trend based on percentage change.
 */
export function determineTrend(changePercent: number): 'up' | 'down' | 'neutral' {
  if (changePercent > 0) return 'up'
  if (changePercent < 0) return 'down'
  return 'neutral'
}

/**
 * Determines if a change is positive (i.e., an improvement) based on the trend
 * and whether higher values are better for that specific metric.
 */
export function determineIsPositiveChange(
  trend: 'up' | 'down' | 'neutral',
  isHigherBetter: boolean,
): boolean {
  if (isHigherBetter && trend === 'up') return true
  if (!isHigherBetter && trend === 'down') return true
  return false
}
