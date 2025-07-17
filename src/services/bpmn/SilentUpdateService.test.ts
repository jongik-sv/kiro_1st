/**
 * SilentUpdateService 단위 테스트
 */

import {
  SilentUpdateService,
  SilentUpdateOperation,
} from './SilentUpdateService';

// Mock 객체들
const mockCanvas = {
  getRootElement: jest.fn(() => ({ id: 'root' })),
  getContainer: jest.fn(() => document.createElement('div')),
  _addElement: jest.fn(),
  _removeElement: jest.fn(),
  _suspendRendering: false,
  _redraw: jest.fn(),
};

const mockElementRegistry = {
  get: jest.fn(),
  getGraphics: jest.fn(),
  _elements: {},
};

const mockGraphicsFactory = {
  create: jest.fn(() => ({ id: 'mock-gfx' })),
  update: jest.fn(),
};

const mockBpmnFactory = {
  create: jest.fn((type, attrs) => ({ $type: type, ...attrs })),
};

const mockElementFactory = {
  createShape: jest.fn(attrs => ({
    id: attrs.id || 'test-element',
    type: attrs.type,
    businessObject: attrs.businessObject,
    x: attrs.x || 0,
    y: attrs.y || 0,
    width: attrs.width || 100,
    height: attrs.height || 80,
  })),
  createConnection: jest.fn(attrs => ({
    id: attrs.id || 'test-connection',
    type: attrs.type,
    businessObject: attrs.businessObject,
    source: attrs.source,
    target: attrs.target,
    waypoints: attrs.waypoints || [],
  })),
};

const mockModeler = {
  get: jest.fn((service: string) => {
    switch (service) {
      case 'canvas':
        return mockCanvas;
      case 'elementRegistry':
        return mockElementRegistry;
      case 'graphicsFactory':
        return mockGraphicsFactory;
      case 'bpmnFactory':
        return mockBpmnFactory;
      case 'elementFactory':
        return mockElementFactory;
      default:
        return null;
    }
  }),
};

describe('SilentUpdateService', () => {
  let service: SilentUpdateService;

  beforeEach(() => {
    // Mock 초기화
    jest.clearAllMocks();
    mockElementRegistry._elements = {};
    mockCanvas._suspendRendering = false;

    // SilentUpdateService의 private 속성들을 직접 설정
    service = new SilentUpdateService(mockModeler as any);
    (service as any).canvas = mockCanvas;
    (service as any).elementRegistry = mockElementRegistry;
    (service as any).graphicsFactory = mockGraphicsFactory;
    (service as any).bpmnFactory = mockBpmnFactory;
    (service as any).elementFactory = mockElementFactory;
  });

  describe('BusinessObject 직접 조작', () => {
    test('updateBusinessObjectDirectly - 성공적인 업데이트', () => {
      // Arrange
      const mockElement = {
        id: 'test-element',
        businessObject: { $type: 'bpmn:Task', name: 'Old Name' },
      };
      mockElementRegistry.get.mockReturnValue(mockElement);
      mockElementRegistry.getGraphics.mockReturnValue({ id: 'mock-gfx' });

      // Act
      const result = service.updateBusinessObjectDirectly('test-element', {
        name: 'New Name',
      });

      // Assert
      expect(result).toBe(mockElement);
      expect(mockElement.businessObject.name).toBe('New Name');
      expect(mockGraphicsFactory.update).toHaveBeenCalledWith(
        'shape',
        mockElement,
        { id: 'mock-gfx' }
      );
    });

    test('updateBusinessObjectDirectly - 요소가 존재하지 않는 경우', () => {
      // Arrange
      mockElementRegistry.get.mockReturnValue(null);

      // Act
      const result = service.updateBusinessObjectDirectly('non-existent', {
        name: 'Test',
      });

      // Assert
      expect(result).toBeNull();
      expect(mockGraphicsFactory.update).not.toHaveBeenCalled();
    });

    test('setBusinessObjectProperty - 중첩된 속성 설정', () => {
      // Arrange
      const mockElement = {
        id: 'test-element',
        businessObject: { $type: 'bpmn:Task' },
      };
      mockElementRegistry.get.mockReturnValue(mockElement);
      mockElementRegistry.getGraphics.mockReturnValue({ id: 'mock-gfx' });

      // Act
      const result = service.setBusinessObjectProperty(
        'test-element',
        'documentation.text',
        'Test Documentation'
      );

      // Assert
      expect(result).toBe(true);
      expect(mockElement.businessObject.documentation.text).toBe(
        'Test Documentation'
      );
    });
  });

  describe('Canvas 직접 요소 추가/제거', () => {
    test('addElementSilently - 새 요소 생성', () => {
      // Arrange
      const elementData = {
        id: 'new-element',
        type: 'bpmn:Task',
        x: 100,
        y: 200,
        properties: { name: 'New Task' },
      };

      // Act
      const result = service.addElementSilently(elementData);

      // Assert
      expect(mockBpmnFactory.create).toHaveBeenCalledWith('bpmn:Task', {
        name: 'New Task',
      });
      expect(mockElementFactory.createShape).toHaveBeenCalled();
      expect(mockCanvas._addElement).toHaveBeenCalled();
      expect(mockGraphicsFactory.create).toHaveBeenCalledWith(
        'shape',
        expect.any(Object)
      );
      expect(result.id).toBe('new-element');
    });

    test('removeElementSilently - 요소 제거', () => {
      // Arrange
      const mockElement = {
        id: 'test-element',
        incoming: [],
        outgoing: [],
      };
      mockElementRegistry.get.mockReturnValue(mockElement);
      mockElementRegistry._elements['test-element'] = {
        element: mockElement,
        gfx: {},
      };

      // Act
      const result = service.removeElementSilently('test-element');

      // Assert
      expect(result).toBe(true);
      expect(mockCanvas._removeElement).toHaveBeenCalledWith(mockElement);
      expect(mockElementRegistry._elements['test-element']).toBeUndefined();
    });

    test('addConnectionSilently - 연결 생성', () => {
      // Arrange
      const sourceElement = {
        id: 'source',
        x: 100,
        y: 100,
        width: 100,
        height: 80,
        businessObject: { $type: 'bpmn:Task' },
        outgoing: [],
      };
      const targetElement = {
        id: 'target',
        x: 300,
        y: 100,
        width: 100,
        height: 80,
        businessObject: { $type: 'bpmn:Task' },
        incoming: [],
      };

      mockElementRegistry.get
        .mockReturnValueOnce(sourceElement)
        .mockReturnValueOnce(targetElement);

      const connectionData = {
        id: 'test-connection',
        type: 'bpmn:SequenceFlow',
        properties: { name: 'Flow' },
      };

      // Act
      const result = service.addConnectionSilently(
        connectionData,
        'source',
        'target'
      );

      // Assert
      expect(result).toBeTruthy();
      expect(mockBpmnFactory.create).toHaveBeenCalledWith('bpmn:SequenceFlow', {
        name: 'Flow',
      });
      expect(mockElementFactory.createConnection).toHaveBeenCalled();
      expect(sourceElement.outgoing).toContain(result);
      expect(targetElement.incoming).toContain(result);
    });
  });

  describe('시각적 속성 업데이트', () => {
    test('updateVisualPropertiesDirectly - 위치 및 크기 변경', () => {
      // Arrange
      const mockElement = {
        id: 'test-element',
        x: 100,
        y: 100,
        width: 100,
        height: 80,
      };
      mockElementRegistry.get.mockReturnValue(mockElement);
      mockElementRegistry.getGraphics.mockReturnValue({ id: 'mock-gfx' });

      // Act
      const result = service.updateVisualPropertiesDirectly('test-element', {
        x: 200,
        y: 150,
        width: 120,
        height: 90,
      });

      // Assert
      expect(result).toBe(mockElement);
      expect(mockElement.x).toBe(200);
      expect(mockElement.y).toBe(150);
      expect(mockElement.width).toBe(120);
      expect(mockElement.height).toBe(90);
      expect(mockGraphicsFactory.update).toHaveBeenCalled();
    });

    test('setElementPosition - 위치 설정', () => {
      // Arrange
      const mockElement = { id: 'test-element', x: 0, y: 0 };
      mockElementRegistry.get.mockReturnValue(mockElement);
      mockElementRegistry.getGraphics.mockReturnValue({ id: 'mock-gfx' });

      // Act
      const result = service.setElementPosition('test-element', 150, 200);

      // Assert
      expect(result).toBe(true);
      expect(mockElement.x).toBe(150);
      expect(mockElement.y).toBe(200);
    });
  });

  describe('렌더링 제어', () => {
    test('suspendRendering - 렌더링 일시 중단', () => {
      // Act
      service.suspendRendering();

      // Assert
      expect(mockCanvas._suspendRendering).toBe(true);
    });

    test('resumeRendering - 렌더링 재개', () => {
      // Arrange
      mockCanvas._suspendRendering = true;

      // Act
      service.resumeRendering();

      // Assert
      expect(mockCanvas._suspendRendering).toBe(false);
      expect(mockCanvas._redraw).toHaveBeenCalled();
    });

    test('isRenderingSuspended - 렌더링 상태 확인', () => {
      // Arrange
      mockCanvas._suspendRendering = true;

      // Act & Assert
      expect(service.isRenderingSuspended()).toBe(true);

      mockCanvas._suspendRendering = false;
      expect(service.isRenderingSuspended()).toBe(false);
    });
  });

  describe('배치 업데이트', () => {
    test('batchUpdate - 여러 작업 배치 처리', () => {
      // Arrange
      const mockElement = {
        id: 'test-element',
        businessObject: { $type: 'bpmn:Task', name: 'Old' },
      };
      mockElementRegistry.get.mockReturnValue(mockElement);
      mockElementRegistry.getGraphics.mockReturnValue({ id: 'mock-gfx' });

      const updates: SilentUpdateOperation[] = [
        {
          type: 'business',
          elementId: 'test-element',
          data: { name: 'Updated Name' },
        },
        {
          type: 'visual',
          elementId: 'test-element',
          data: { x: 200, y: 300 },
        },
      ];

      // Act
      service.batchUpdate(updates);

      // Assert
      expect(mockCanvas._suspendRendering).toBe(false); // 작업 완료 후 재개됨
      expect(mockCanvas._redraw).toHaveBeenCalled();
      expect(mockElement.businessObject.name).toBe('Updated Name');
    });

    test('batchUpdateOptimized - 타입별 그룹화 처리', () => {
      // Arrange
      const updates: SilentUpdateOperation[] = [
        { type: 'create', data: { type: 'bpmn:Task', x: 100, y: 100 } },
        { type: 'business', elementId: 'element1', data: { name: 'Test' } },
        { type: 'remove', elementId: 'element2' },
      ];

      const mockElement = { id: 'element1', businessObject: {} };
      const mockElement2 = { id: 'element2', incoming: [], outgoing: [] };

      mockElementRegistry.get
        .mockReturnValueOnce(mockElement)
        .mockReturnValueOnce(mockElement2);
      mockElementRegistry.getGraphics.mockReturnValue({ id: 'mock-gfx' });

      // Act
      service.batchUpdateOptimized(updates);

      // Assert
      expect(mockBpmnFactory.create).toHaveBeenCalled(); // create 작업
      expect(mockCanvas._removeElement).toHaveBeenCalled(); // remove 작업
      expect(mockCanvas._redraw).toHaveBeenCalled();
    });
  });

  describe('유틸리티 메서드', () => {
    test('elementExists - 요소 존재 확인', () => {
      // Arrange
      mockElementRegistry.get
        .mockReturnValueOnce({ id: 'existing' })
        .mockReturnValueOnce(undefined);

      // Act & Assert
      expect(service.elementExists('existing')).toBe(true);
      expect(service.elementExists('non-existing')).toBe(false);
    });

    test('getAllElementIds - 모든 요소 ID 반환', () => {
      // Arrange
      mockElementRegistry._elements = {
        element1: { element: {}, gfx: {} },
        element2: { element: {}, gfx: {} },
      };

      // Act
      const ids = service.getAllElementIds();

      // Assert
      expect(ids).toEqual(['element1', 'element2']);
    });

    test('getElementCountByType - 타입별 개수 반환', () => {
      // Arrange
      mockElementRegistry._elements = {
        task1: { element: { businessObject: { $type: 'bpmn:Task' } }, gfx: {} },
        task2: { element: { businessObject: { $type: 'bpmn:Task' } }, gfx: {} },
        gateway1: {
          element: { businessObject: { $type: 'bpmn:Gateway' } },
          gfx: {},
        },
      };

      // Act
      const counts = service.getElementCountByType();

      // Assert
      expect(counts).toEqual({
        'bpmn:Task': 2,
        'bpmn:Gateway': 1,
      });
    });

    test('getServiceInfo - 서비스 상태 정보 반환', () => {
      // Arrange
      mockElementRegistry._elements = {
        element1: {
          element: { businessObject: { $type: 'bpmn:Task' } },
          gfx: {},
        },
      };
      mockCanvas._suspendRendering = true;

      // Act
      const info = service.getServiceInfo();

      // Assert
      expect(info).toEqual({
        elementCount: 1,
        isRenderingSuspended: true,
        elementTypes: { 'bpmn:Task': 1 },
      });
    });
  });
});
