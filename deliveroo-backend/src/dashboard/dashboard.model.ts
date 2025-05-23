export type MetricTrend = 'up' | 'down' | 'neutral'

export interface Metric {
  title: string
  icon: string
  isHigherBetter: boolean
  // Function to fetch its value for a given period
  queryFn: (startDate: Date, endDate: Date) => Promise<number>
  // Function to format its value for display
  valueFormatter: (value: number) => string
  // Function to format its change string
  changeFormatter: (percentage: number) => string
}

export interface MetricDTO {
  title: string
  icon: string
  value: string // Formatted current value
  change: string // Formatted change string (e.g., "+10.5%")
  trend: MetricTrend
  isPositiveChange: boolean
}
