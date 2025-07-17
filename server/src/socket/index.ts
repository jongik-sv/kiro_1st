import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';
import { handleCollaboration } from './collaborationHandler';
import { handleUserPresence } from './presenceHandler';

export function setupSocketHandlers(io: SocketIOServer): void {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // 사용자 인증 및 초기 설정
    socket.on('authenticate', async (data) => {
      try {
        const { userId, username } = data;
        
        if (!userId || !username) {
          socket.emit('auth_error', { message: 'User ID and username are required' });
          return;
        }

        // 소켓에 사용자 정보 저장
        socket.data.userId = userId;
        socket.data.username = username;

        // 사용자 온라인 상태 업데이트
        await handleUserPresence.setUserOnline(userId, socket.id);

        socket.emit('authenticated', { 
          message: 'Authentication successful',
          userId,
          username 
        });

        logger.info(`User authenticated: ${username} (${userId})`);
      } catch (error) {
        logger.error('Authentication error:', error);
        socket.emit('auth_error', { message: 'Authentication failed' });
      }
    });

    // 다이어그램 룸 참여
    socket.on('join_diagram', async (data) => {
      try {
        const { diagramId } = data;
        const { userId, username } = socket.data;

        if (!userId) {
          socket.emit('error', { message: 'User not authenticated' });
          return;
        }

        if (!diagramId) {
          socket.emit('error', { message: 'Diagram ID is required' });
          return;
        }

        // 다이어그램 룸에 참여
        await socket.join(`diagram:${diagramId}`);
        
        // 협업 세션에 참가자 추가
        await handleCollaboration.addParticipant(diagramId, userId, socket.id);

        // 룸의 다른 사용자들에게 새 참가자 알림
        socket.to(`diagram:${diagramId}`).emit('user_joined', {
          userId,
          username,
          timestamp: new Date()
        });

        // 현재 참가자 목록 전송
        const participants = await handleCollaboration.getParticipants(diagramId);
        socket.emit('participants_updated', { participants });

        logger.info(`User ${username} joined diagram ${diagramId}`);
      } catch (error) {
        logger.error('Error joining diagram:', error);
        socket.emit('error', { message: 'Failed to join diagram' });
      }
    });

    // 다이어그램 룸 떠나기
    socket.on('leave_diagram', async (data) => {
      try {
        const { diagramId } = data;
        const { userId, username } = socket.data;

        if (!userId || !diagramId) {
          return;
        }

        await socket.leave(`diagram:${diagramId}`);
        await handleCollaboration.removeParticipant(diagramId, userId);

        // 룸의 다른 사용자들에게 참가자 떠남 알림
        socket.to(`diagram:${diagramId}`).emit('user_left', {
          userId,
          username,
          timestamp: new Date()
        });

        logger.info(`User ${username} left diagram ${diagramId}`);
      } catch (error) {
        logger.error('Error leaving diagram:', error);
      }
    });

    // 다이어그램 변경사항 브로드캐스트
    socket.on('diagram_change', async (data) => {
      try {
        const { diagramId, changes, version } = data;
        const { userId, username } = socket.data;

        if (!userId || !diagramId) {
          socket.emit('error', { message: 'User not authenticated or diagram ID missing' });
          return;
        }

        // 변경사항을 룸의 다른 사용자들에게 브로드캐스트
        socket.to(`diagram:${diagramId}`).emit('diagram_updated', {
          changes,
          version,
          userId,
          username,
          timestamp: new Date()
        });

        logger.debug(`Diagram ${diagramId} updated by ${username}`);
      } catch (error) {
        logger.error('Error broadcasting diagram change:', error);
      }
    });

    // 커서 위치 업데이트
    socket.on('cursor_move', async (data) => {
      try {
        const { diagramId, x, y } = data;
        const { userId, username } = socket.data;

        if (!userId || !diagramId) {
          return;
        }

        // 커서 위치를 룸의 다른 사용자들에게 브로드캐스트
        socket.to(`diagram:${diagramId}`).emit('cursor_updated', {
          userId,
          username,
          x,
          y,
          timestamp: new Date()
        });

        // 협업 세션에 커서 위치 업데이트
        await handleCollaboration.updateCursor(diagramId, userId, { x, y });
      } catch (error) {
        logger.error('Error updating cursor:', error);
      }
    });

    // 연결 해제 처리
    socket.on('disconnect', async () => {
      try {
        const { userId, username } = socket.data;
        
        if (userId) {
          // 사용자 오프라인 상태로 변경
          await handleUserPresence.setUserOffline(userId);

          // 모든 협업 세션에서 제거
          await handleCollaboration.removeParticipantFromAllSessions(userId);

          logger.info(`User ${username} (${userId}) disconnected`);
        }

        logger.info(`Client disconnected: ${socket.id}`);
      } catch (error) {
        logger.error('Error handling disconnect:', error);
      }
    });

    // 에러 처리
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
    });
  });

  logger.info('Socket.IO handlers setup complete');
}