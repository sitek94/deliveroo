import {MetricDTO, Metric} from './dashboard.model'
import * as queries from './dashboard.queries'
import * as utils from './dashboard.utils'

const defaultChangeFormatter = (percentage: number) =>
  `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`

const METRIC_DEFINITIONS: Metric[] = [
  {
    title: 'Total Completed Deliveries',
    icon: 'local_shipping',
    isHigherBetter: true,
    queryFn: queries.getTotalCompletedDeliveries,
    valueFormatter: value => `${Math.round(value)}`,
    changeFormatter: defaultChangeFormatter,
  },
  {
    title: 'On-Time Rate',
    icon: 'check_circle',
    isHigherBetter: true,
    queryFn: queries.getOnTimeRate,
    valueFormatter: value => `${value.toFixed(1)}%`,
    changeFormatter: defaultChangeFormatter,
  },
  {
    title: 'Fuel Efficiency (MPG)',
    icon: 'local_gas_station',
    isHigherBetter: true,
    queryFn: queries.getFuelEfficiency,
    valueFormatter: value => `${value.toFixed(1)} MPG`,
    changeFormatter: defaultChangeFormatter,
  },
  {
    title: 'Average Delivery Duration',
    icon: 'schedule',
    isHigherBetter: false,
    queryFn: queries.getAverageDeliveryDurationInMinutes,
    valueFormatter: value => {
      const hours = Math.floor(value / 60)
      const minutes = Math.floor(value % 60)
      return `${hours}h ${minutes}m`
    },
    changeFormatter: defaultChangeFormatter,
  },
]

export async function getDashboardMetrics(): Promise<MetricDTO[]> {
  const {currentPeriod, previousPeriod} = utils.getMetricDatePeriods()
  const metrics: MetricDTO[] = []

  for (const definition of METRIC_DEFINITIONS) {
    const [currentValue, previousValue] = await Promise.all([
      definition.queryFn(currentPeriod.startDate, currentPeriod.endDate),
      definition.queryFn(previousPeriod.startDate, previousPeriod.endDate),
    ])

    const changePercent = utils.calculatePercentageChange(currentValue, previousValue)
    const trend = utils.determineTrend(changePercent)
    const isPositiveChange = utils.determineIsPositiveChange(trend, definition.isHigherBetter)

    metrics.push({
      title: definition.title,
      icon: definition.icon,
      value: definition.valueFormatter(currentValue),
      change: definition.changeFormatter(changePercent),
      trend,
      isPositiveChange,
    })
  }

  return metrics
}
