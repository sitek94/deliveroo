import express from 'express'
import * as dashboardService from './dashboard.service'
import logger from '../logger'
import redisClient from '../redis'

export const dashboardRouter = express.Router()

dashboardRouter.get('/metrics', async (_, res) => {
  try {
    const cachedMetrics = await redisClient.get('dashboard-metrics')
    if (cachedMetrics) {
      logger.info('Returning dashboard metrics from cache')
      res.json(JSON.parse(cachedMetrics))
      return
    }
    const metrics = await dashboardService.getDashboardMetrics()
    await redisClient.set('dashboard-metrics', JSON.stringify(metrics), {EX: 60})
    res.json(metrics)
  } catch (error) {
    logger.error('Error fetching dashboard metrics:', {error})
    res.status(500).json({error: 'Failed to fetch dashboard metrics'})
  }
})
