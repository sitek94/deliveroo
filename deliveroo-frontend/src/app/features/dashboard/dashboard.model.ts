export type MetricTrend = 'up' | 'down' | 'neutral'

export interface MetricDTO {
  title: string
  icon: string
  value: string
  change: string
  trend: MetricTrend
  isPositiveChange: boolean
}
