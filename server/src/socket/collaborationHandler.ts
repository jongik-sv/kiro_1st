import { CollaborationSession } from '../models';
import { logger } from '../utils/logger';

export const handleCollaboration = {
  // 협업 세션에 참가자 추가
  async addParticipant(diagramId: string, userId: string, socketId: string) {
    try {
      let session = await CollaborationSession.findOne({ diagramId, isActive: true });

      if (!session) {
        // 새 협업 세션 생성
        session = new CollaborationSession({
          diagramId,
          participants: [],
          isActive: true
        });
      }

      // 기존 참가자 확인 및 업데이트
      const existingParticipant = session.participants.find(p => p.userId === userId);
      
      if (existingParticipant) {
        existingParticipant.socketId = socketId;
        existingParticipant.joinedAt = new Date();
      } else {
        session.participants.push({
          userId,
          socketId,
          joinedAt: new Date()
        });
      }

      await session.save();
      logger.debug(`Added participant ${userId} to diagram ${diagramId}`);
      
      return session;
    } catch (error) {
      logger.error('Error adding participant to collaboration session:', error);
      throw error;
    }
  },

  // 협업 세션에서 참가자 제거
  async removeParticipant(diagramId: string, userId: string) {
    try {
      const session = await CollaborationSession.findOne({ diagramId, isActive: true });
      
      if (!session) {
        return;
      }

      session.participants = session.participants.filter(p => p.userId !== userId);

      if (session.participants.length === 0) {
        // 참가자가 없으면 세션 비활성화
        session.isActive = false;
      }

      await session.save();
      logger.debug(`Removed participant ${userId} from diagram ${diagramId}`);
      
      return session;
    } catch (error) {
      logger.error('Error removing participant from collaboration session:', error);
      throw error;
    }
  },

  // 모든 협업 세션에서 참가자 제거 (연결 해제 시)
  async removeParticipantFromAllSessions(userId: string) {
    try {
      const sessions = await CollaborationSession.find({
        'participants.userId': userId,
        isActive: true
      });

      for (const session of sessions) {
        session.participants = session.participants.filter(p => p.userId !== userId);
        
        if (session.participants.length === 0) {
          session.isActive = false;
        }
        
        await session.save();
      }

      logger.debug(`Removed participant ${userId} from all active sessions`);
    } catch (error) {
      logger.error('Error removing participant from all sessions:', error);
      throw error;
    }
  },

  // 협업 세션 참가자 목록 조회
  async getParticipants(diagramId: string) {
    try {
      const session = await CollaborationSession.findOne({ diagramId, isActive: true })
        .populate('participants.userId', 'username email avatar');

      if (!session) {
        return [];
      }

      return session.participants.map(p => ({
        userId: p.userId,
        socketId: p.socketId,
        joinedAt: p.joinedAt,
        cursor: p.cursor
      }));
    } catch (error) {
      logger.error('Error getting collaboration participants:', error);
      throw error;
    }
  },

  // 커서 위치 업데이트
  async updateCursor(diagramId: string, userId: string, cursor: { x: number; y: number }) {
    try {
      const session = await CollaborationSession.findOne({ diagramId, isActive: true });
      
      if (!session) {
        return;
      }

      const participant = session.participants.find(p => p.userId === userId);
      if (participant) {
        participant.cursor = cursor;
        await session.save();
      }
    } catch (error) {
      logger.error('Error updating cursor position:', error);
      throw error;
    }
  },

  // 활성 협업 세션 조회
  async getActiveSession(diagramId: string) {
    try {
      return await CollaborationSession.findOne({ diagramId, isActive: true })
        .populate('participants.userId', 'username email avatar');
    } catch (error) {
      logger.error('Error getting active collaboration session:', error);
      throw error;
    }
  },

  // 비활성 세션 정리 (주기적으로 실행)
  async cleanupInactiveSessions() {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24시간 전
      
      await CollaborationSession.deleteMany({
        isActive: false,
        updatedAt: { $lt: cutoffTime }
      });

      logger.debug('Cleaned up inactive collaboration sessions');
    } catch (error) {
      logger.error('Error cleaning up inactive sessions:', error);
    }
  }
};