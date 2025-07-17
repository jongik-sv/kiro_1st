/**
 * CollaborationEventManager 테스트
 */

import {
  CollaborationEventManager,
  ChangeEvent,
} from './CollaborationEventManager';
import { SilentUpdateService } from './SilentUpdateService';

// Mock 객체들
const mockEventBus = {
  on: jest.fn(),
  off: jest.fn(),
  fire: jest.fn(),
};

const mockSilentUpdateService = {
  updateBusinessObjectDirectly: jest.fn(),
  updateVisualPropertiesDirectly: jest.fn(),
  addElementSilently: jest.fn(),
  removeElementSilently: jest.fn(),
  suspendRendering: jest.fn(),
  resumeRendering: jest.fn(),
} as unknown as SilentUpdateService;

const mockModeler = {
  get: jest.fn(),
};

// mockModeler.get이 'eventBus'를 요청할 때 mockEventBus를 반환하도록 설정
mockModeler.get.mockImplementation((service: string) => {
  if (service === 'eventBus') {
    return mockEventBus;
  }
  return null;
});

describe('CollaborationEventManager', () => {
  let manager: CollaborationEventManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new CollaborationEventManager(
      mockModeler,
      mockSilentUpdateService
    );
  });

  afterEach(() => {
    if (manager) {
      manager.cleanup();
    }
  });

  describe('초기화', () => {
    it('생성자에서 이벤트 리스너를 설정해야 한다', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'element.changed',
        expect.any(Function)
      );
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'commandStack.changed',
        expect.any(Function)
      );
      expect(mockEventBus.on).toHaveBeenCalledWith(
        ['shape.added', 'connection.added'],
        expect.any(Function)
      );
      expect(mockEventBus.on).toHaveBeenCalledWith(
        ['shape.removed', 'connection.removed'],
        expect.any(Function)
      );
      expect(mockEventBus.on).toHaveBeenCalledWith(
        ['shape.moved', 'connection.moved'],
        expect.any(Function)
      );
    });

    it('서비스 정보를 올바르게 반환해야 한다', () => {
      const info = manager.getServiceInfo();

      expect(info).toEqual({
        isProcessingRemoteEvent: false,
        remoteEventSourcesCount: 0,
        changeTrackerSize: 0,
        eventSourceHistorySize: 0,
        changeBufferSize: 0,
      });
    });
  });

  describe('원격 변경사항 처리', () => {
    it('원격 변경사항을 올바르게 적용해야 한다', () => {
      const changes: ChangeEvent[] = [
        {
          type: 'property',
          elementId: 'element1',
          properties: { name: 'Updated Name' },
          timestamp: Date.now(),
        },
        {
          type: 'position',
          elementId: 'element2',
          x: 100,
          y: 200,
          timestamp: Date.now(),
        },
      ];

      manager.applyRemoteChanges(changes);

      expect(mockSilentUpdateService.suspendRendering).toHaveBeenCalled();
      expect(
        mockSilentUpdateService.updateBusinessObjectDirectly
      ).toHaveBeenCalledWith('element1', { name: 'Updated Name' });
      expect(
        mockSilentUpdateService.updateVisualPropertiesDirectly
      ).toHaveBeenCalledWith('element2', { x: 100, y: 200 });
      expect(mockSilentUpdateService.resumeRendering).toHaveBeenCalled();
    });

    it('빈 변경사항 배열을 처리해야 한다', () => {
      manager.applyRemoteChanges([]);

      expect(mockSilentUpdateService.suspendRendering).not.toHaveBeenCalled();
      expect(mockSilentUpdateService.resumeRendering).not.toHaveBeenCalled();
    });

    it('생성 변경사항을 처리해야 한다', () => {
      const changes: ChangeEvent[] = [
        {
          type: 'create',
          elementId: 'newElement',
          elementData: {
            id: 'newElement',
            type: 'bpmn:Task',
            x: 100,
            y: 100,
          },
          timestamp: Date.now(),
        },
      ];

      manager.applyRemoteChanges(changes);

      expect(mockSilentUpdateService.addElementSilently).toHaveBeenCalledWith({
        id: 'newElement',
        type: 'bpmn:Task',
        x: 100,
        y: 100,
      });
    });

    it('삭제 변경사항을 처리해야 한다', () => {
      const changes: ChangeEvent[] = [
        {
          type: 'remove',
          elementId: 'elementToRemove',
          timestamp: Date.now(),
        },
      ];

      manager.applyRemoteChanges(changes);

      expect(
        mockSilentUpdateService.removeElementSilently
      ).toHaveBeenCalledWith('elementToRemove');
    });
  });

  describe('무한 루프 방지', () => {
    it('원격 이벤트 처리 중에는 로컬 이벤트를 무시해야 한다', () => {
      const localChangeCallback = jest.fn();
      manager.onLocalChange(localChangeCallback);

      // 원격 변경사항 적용 중
      const changes: ChangeEvent[] = [
        {
          type: 'property',
          elementId: 'element1',
          properties: { name: 'Remote Update' },
          timestamp: Date.now(),
        },
      ];

      manager.applyRemoteChanges(changes);

      // 이벤트 리스너에서 element.changed 이벤트 시뮬레이션
      const elementChangedHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'element.changed'
      )[1];

      // 원격 이벤트 처리 중에 발생한 로컬 이벤트는 무시되어야 함
      elementChangedHandler({
        element: {
          id: 'element1',
          businessObject: { name: 'Remote Update' },
        },
      });

      expect(localChangeCallback).not.toHaveBeenCalled();
    });

    it('원격 이벤트 소스로 표시된 요소의 이벤트를 무시해야 한다', done => {
      const localChangeCallback = jest.fn();
      manager.onLocalChange(localChangeCallback);

      // 원격 변경사항 적용
      const changes: ChangeEvent[] = [
        {
          type: 'property',
          elementId: 'element1',
          properties: { name: 'Remote Update' },
          timestamp: Date.now(),
        },
      ];

      manager.applyRemoteChanges(changes);

      // 잠시 후 로컬 이벤트 발생 시뮬레이션
      setTimeout(() => {
        const elementChangedHandler = mockEventBus.on.mock.calls.find(
          call => call[0] === 'element.changed'
        )[1];

        elementChangedHandler({
          element: {
            id: 'element1',
            businessObject: { name: 'Remote Update' },
          },
        });

        expect(localChangeCallback).not.toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('변경사항 추적', () => {
    it('로컬 변경사항을 추적해야 한다', done => {
      const localChangeCallback = jest.fn();
      manager.onLocalChange(localChangeCallback);

      // element.changed 이벤트 시뮬레이션
      const elementChangedHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'element.changed'
      )[1];

      elementChangedHandler({
        element: {
          id: 'element1',
          businessObject: {
            $type: 'bpmn:Task',
            name: 'Local Update',
          },
        },
      });

      // 디바운싱 때문에 잠시 대기
      setTimeout(() => {
        expect(localChangeCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'property',
            elementId: 'element1',
            properties: expect.objectContaining({
              name: 'Local Update',
            }),
          })
        );
        done();
      }, 150);
    });

    it('중복 변경사항을 필터링해야 한다', done => {
      const localChangeCallback = jest.fn();
      manager.onLocalChange(localChangeCallback);

      const elementChangedHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'element.changed'
      )[1];

      const element = {
        id: 'element1',
        businessObject: {
          $type: 'bpmn:Task',
          name: 'Update',
        },
      };

      // 같은 요소에 대한 연속적인 변경사항
      elementChangedHandler({ element });
      elementChangedHandler({ element });
      elementChangedHandler({ element });

      setTimeout(() => {
        // 디바운싱으로 인해 한 번만 호출되어야 함
        expect(localChangeCallback).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    });
  });

  describe('콜백 관리', () => {
    it('로컬 변경사항 콜백을 설정하고 호출해야 한다', done => {
      const callback = jest.fn();
      manager.onLocalChange(callback);

      // shape.added 이벤트 시뮬레이션
      const shapeAddedHandler = mockEventBus.on.mock.calls.find(
        call => Array.isArray(call[0]) && call[0].includes('shape.added')
      )[1];

      shapeAddedHandler({
        element: {
          id: 'newShape',
          businessObject: { $type: 'bpmn:Task' },
          x: 100,
          y: 100,
          width: 100,
          height: 80,
        },
      });

      // 즉시 호출되어야 함 (디바운싱 없음)
      setTimeout(() => {
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'create',
            elementId: 'newShape',
          })
        );
        done();
      }, 10);
    });

    it('원격 변경사항 콜백을 설정하고 호출해야 한다', () => {
      const callback = jest.fn();
      manager.onRemoteChange(callback);

      const changes: ChangeEvent[] = [
        {
          type: 'property',
          elementId: 'element1',
          properties: { name: 'Remote Update' },
          timestamp: Date.now(),
        },
      ];

      manager.applyRemoteChanges(changes);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'property',
          elementId: 'element1',
          properties: { name: 'Remote Update' },
        })
      );
    });
  });

  describe('정리 및 유지보수', () => {
    it('cleanup 메서드가 모든 리소스를 정리해야 한다', () => {
      const callback = jest.fn();
      manager.onLocalChange(callback);
      manager.onRemoteChange(callback);

      // 일부 상태 생성
      manager.applyRemoteChanges([
        {
          type: 'property',
          elementId: 'element1',
          properties: { name: 'Test' },
          timestamp: Date.now(),
        },
      ]);

      const infoBefore = manager.getServiceInfo();
      expect(infoBefore.eventSourceHistorySize).toBeGreaterThan(0);

      manager.cleanup();

      const infoAfter = manager.getServiceInfo();
      expect(infoAfter).toEqual({
        isProcessingRemoteEvent: false,
        remoteEventSourcesCount: 0,
        changeTrackerSize: 0,
        eventSourceHistorySize: 0,
        changeBufferSize: 0,
      });
    });

    it('만료된 이벤트를 자동으로 정리해야 한다', done => {
      // 이 테스트는 실제 타이머를 사용하므로 시간이 오래 걸릴 수 있음
      // 실제 환경에서는 더 짧은 TTL을 사용하거나 수동으로 정리 메서드를 호출할 수 있음

      manager.applyRemoteChanges([
        {
          type: 'property',
          elementId: 'element1',
          properties: { name: 'Test' },
          timestamp: Date.now() - 10000, // 10초 전
        },
      ]);

      // 정리 로직이 실행될 때까지 대기
      setTimeout(() => {
        const info = manager.getServiceInfo();
        // 만료된 이벤트가 정리되었는지 확인
        // 실제로는 내부 정리 로직에 따라 달라질 수 있음
        expect(info.eventSourceHistorySize).toBe(0);
        done();
      }, 100);
    });
  });

  describe('에러 처리', () => {
    it('잘못된 변경사항 데이터를 처리해야 한다', () => {
      const invalidChanges: any[] = [
        {
          type: 'invalid',
          elementId: 'element1',
          timestamp: Date.now(),
        },
        {
          // type 누락
          elementId: 'element2',
          timestamp: Date.now(),
        },
        {
          type: 'property',
          // elementId 누락
          properties: { name: 'Test' },
          timestamp: Date.now(),
        },
      ];

      // 에러 없이 처리되어야 함
      expect(() => {
        manager.applyRemoteChanges(invalidChanges);
      }).not.toThrow();
    });

    it('null 또는 undefined 요소를 처리해야 한다', () => {
      const elementChangedHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'element.changed'
      )[1];

      // null 요소
      expect(() => {
        elementChangedHandler({ element: null });
      }).not.toThrow();

      // undefined 요소
      expect(() => {
        elementChangedHandler({ element: undefined });
      }).not.toThrow();

      // ID가 없는 요소
      expect(() => {
        elementChangedHandler({
          element: {
            businessObject: { $type: 'bpmn:Task' },
          },
        });
      }).not.toThrow();
    });
  });
});
