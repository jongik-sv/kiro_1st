import { Router } from 'express';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: 'unknown',
        redis: 'unknown'
      }
    };

    // MongoDB 상태 확인
    try {
      if (mongoose.connection.readyState === 1) {
        health.services.mongodb = 'connected';
      } else {
        health.services.mongodb = 'disconnected';
      }
    } catch (error) {
      health.services.mongodb = 'error';
    }

    // Redis 상태 확인
    try {
      const redisClient = getRedisClient();
      await redisClient.ping();
      health.services.redis = 'connected';
    } catch (error) {
      health.services.redis = 'disconnected';
    }

    // 전체 상태 결정
    const allServicesHealthy = Object.values(health.services).every(status => status === 'connected');
    health.status = allServicesHealthy ? 'ok' : 'degraded';

    const statusCode = allServicesHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

export { router as healthRouter };