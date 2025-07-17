import { User } from '../models';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

export const handleUserPresence = {
  // 사용자 온라인 상태로 설정
  async setUserOnline(userId: string, socketId: string) {
    try {
      // MongoDB에서 사용자 온라인 상태 업데이트
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date()
      });

      // Redis에 소켓 ID 저장 (빠른 조회를 위해)
      const redisClient = getRedisClient();
      await redisClient.setEx(`user:${userId}:socket`, 3600, socketId); // 1시간 TTL
      await redisClient.setEx(`socket:${socketId}:user`, 3600, userId);

      logger.debug(`User ${userId} set to online with socket ${socketId}`);
    } catch (error) {
      logger.error('Error setting user online:', error);
      throw error;
    }
  },

  // 사용자 오프라인 상태로 설정
  async setUserOffline(userId: string) {
    try {
      // MongoDB에서 사용자 오프라인 상태 업데이트
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date()
      });

      // Redis에서 소켓 정보 제거
      const redisClient = getRedisClient();
      const socketId = await redisClient.get(`user:${userId}:socket`);
      
      if (socketId) {
        await redisClient.del(`user:${userId}:socket`);
        await redisClient.del(`socket:${socketId}:user`);
      }

      logger.debug(`User ${userId} set to offline`);
    } catch (error) {
      logger.error('Error setting user offline:', error);
      throw error;
    }
  },

  // 사용자 온라인 상태 확인
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const redisClient = getRedisClient();
      const socketId = await redisClient.get(`user:${userId}:socket`);
      return !!socketId;
    } catch (error) {
      logger.error('Error checking user online status:', error);
      // Redis 오류 시 MongoDB에서 확인
      try {
        const user = await User.findById(userId, { isOnline: 1 });
        return user?.isOnline || false;
      } catch (dbError) {
        logger.error('Error checking user status from database:', dbError);
        return false;
      }
    }
  },

  // 온라인 사용자 목록 조회
  async getOnlineUsers(): Promise<string[]> {
    try {
      const redisClient = getRedisClient();
      const keys = await redisClient.keys('user:*:socket');
      
      return keys.map(key => {
        const match = key.match(/user:(.+):socket/);
        return match ? match[1] : null;
      }).filter(Boolean) as string[];
    } catch (error) {
      logger.error('Error getting online users:', error);
      // Redis 오류 시 MongoDB에서 확인
      try {
        const users = await User.find({ isOnline: true }, { _id: 1 });
        return users.map(user => user._id.toString());
      } catch (dbError) {
        logger.error('Error getting online users from database:', dbError);
        return [];
      }
    }
  },

  // 소켓 ID로 사용자 ID 조회
  async getUserBySocketId(socketId: string): Promise<string | null> {
    try {
      const redisClient = getRedisClient();
      return await redisClient.get(`socket:${socketId}:user`);
    } catch (error) {
      logger.error('Error getting user by socket ID:', error);
      return null;
    }
  },

  // 사용자 활동 시간 업데이트
  async updateUserActivity(userId: string) {
    try {
      await User.findByIdAndUpdate(userId, {
        lastSeen: new Date()
      });

      // Redis TTL 갱신
      const redisClient = getRedisClient();
      const socketId = await redisClient.get(`user:${userId}:socket`);
      
      if (socketId) {
        await redisClient.expire(`user:${userId}:socket`, 3600);
        await redisClient.expire(`socket:${socketId}:user`, 3600);
      }
    } catch (error) {
      logger.error('Error updating user activity:', error);
    }
  },

  // 비활성 사용자 정리 (주기적으로 실행)
  async cleanupInactiveUsers() {
    try {
      const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5분 전
      
      await User.updateMany(
        {
          isOnline: true,
          lastSeen: { $lt: cutoffTime }
        },
        {
          isOnline: false
        }
      );

      logger.debug('Cleaned up inactive users');
    } catch (error) {
      logger.error('Error cleaning up inactive users:', error);
    }
  }
};