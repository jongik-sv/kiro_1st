import { SilentModeling } from './SilentModeling';

// Mock dependencies
class MockEventBus {
  on = jest.fn();
  fire = jest.fn();
}

class MockElementFactory {
  createShape = jest.fn();
  createConnection = jest.fn();
}

class MockCanvas {
  getRootElement = jest.fn().mockReturnValue({ id: 'root' });
  _addElement = jest.fn();
  _removeElement = jest.fn();
  _suspendRendering = false;
  _redraw = jest.fn();
}

class MockElementRegistry {
  get = jest.fn();
  getGraphics = jest.fn();
  _elements: any = {};
}

class MockGraphicsFactory {
  create = jest.fn().mockReturnValue('mock-graphics');
  update = jest.fn();
}

class MockSilentCommandStack {
  setSilentMode = jest.fn();
  executeSilently = jest.fn();
}

class MockBpmnRules {
  allowed = jest.fn().mockReturnValue(true);
}

describe('SilentModeling', () => {
  let silentModeling: SilentModeling;
  let mockEventBus: MockEventBus;
  let mockElementFactory: MockElementFactory;
  let mockCanvas: MockCanvas;
  let mockElementRegistry: MockElementRegistry;
  let mockGraphicsFactory: MockGraphicsFactory;
  let mockSilentCommandStack: MockSilentCommandStack;
  let mockBpmnRules: MockBpmnRules;

  beforeEach(() => {
    mockEventBus = new MockEventBus();
    mockElementFactory = new MockElementFactory();
    mockCanvas = new MockCanvas();
    mockElementRegistry = new MockElementRegistry();
    mockGraphicsFactory = new MockGraphicsFactory();
    mockSilentCommandStack = new MockSilentCommandStack();
    mockBpmnRules = new MockBpmnRules();

    silentModeling = new SilentModeling(
      mockEventBus as any,
      mockElementFactory as any,
      mockCanvas as any,
      mockElementRegistry as any,
      mockGraphicsFactory as any,
      mockSilentCommandStack as any,
      mockBpmnRules as any
    );
  });

  describe('updatePropertiesSilently', () => {
    test('should update element properties without events', () => {
      const mockElement = {
        id: 'element1',
        businessObject: { name: 'old name' },
      };

      const newProperties = { name: 'new name', type: 'task' };

      mockElementRegistry.getGraphics.mockReturnValue('mock-graphics');

      silentModeling.updatePropertiesSilently(mockElement, newProperties);

      expect(mockElement.businessObject).toEqual({
        name: 'new name',
        type: 'task',
      });
      expect(mockGraphicsFactory.update).toHaveBeenCalledWith(
        'shape',
        mockElement,
        'mock-graphics'
      );
    });

    test('should handle missing graphics gracefully', () => {
      const mockElement = {
        id: 'element1',
        businessObject: { name: 'old name' },
      };

      mockElementRegistry.getGraphics.mockReturnValue(null);

      expect(() => {
        silentModeling.updatePropertiesSilently(mockElement, {
          name: 'new name',
        });
      }).not.toThrow();

      expect(mockElement.businessObject.name).toBe('new name');
      expect(mockGraphicsFactory.update).not.toHaveBeenCalled();
    });
  });

  describe('moveElementSilently', () => {
    test('should move element without events', () => {
      const mockElement = {
        id: 'element1',
        x: 100,
        y: 200,
      };

      const delta = { x: 50, y: -30 };

      mockElementRegistry.getGraphics.mockReturnValue('mock-graphics');

      silentModeling.moveElementSilently(mockElement, delta);

      expect(mockElement.x).toBe(150);
      expect(mockElement.y).toBe(170);
      expect(mockGraphicsFactory.update).toHaveBeenCalledWith(
        'shape',
        mockElement,
        'mock-graphics'
      );
    });
  });

  describe('createElementSilently', () => {
    test('should create element without events', () => {
      const elementData = {
        type: 'bpmn:Task',
        businessObject: { id: 'task1', name: 'Test Task' },
        width: 100,
        height: 80,
      };

      const position = { x: 200, y: 300 };

      const mockCreatedElement = {
        id: 'task1',
        type: 'bpmn:Task',
        x: 200,
        y: 300,
        width: 100,
        height: 80,
      };

      mockElementFactory.createShape.mockReturnValue(mockCreatedElement);

      const result = silentModeling.createElementSilently(
        elementData,
        position
      );

      expect(mockElementFactory.createShape).toHaveBeenCalledWith({
        type: 'bpmn:Task',
        businessObject: elementData.businessObject,
        x: 200,
        y: 300,
        width: 100,
        height: 80,
      });

      expect(mockCanvas._addElement).toHaveBeenCalledWith(mockCreatedElement, {
        id: 'root',
      });
      expect(mockGraphicsFactory.create).toHaveBeenCalledWith(
        'shape',
        mockCreatedElement
      );
      expect(mockElementRegistry._elements['task1']).toEqual({
        element: mockCreatedElement,
        gfx: 'mock-graphics',
      });
      expect(result).toBe(mockCreatedElement);
    });

    test('should use default dimensions if not provided', () => {
      const elementData = {
        type: 'bpmn:Task',
        businessObject: { id: 'task1' },
      };

      const position = { x: 200, y: 300 };

      mockElementFactory.createShape.mockReturnValue({ id: 'task1' });

      silentModeling.createElementSilently(elementData, position);

      expect(mockElementFactory.createShape).toHaveBeenCalledWith({
        type: 'bpmn:Task',
        businessObject: elementData.businessObject,
        x: 200,
        y: 300,
        width: 100,
        height: 80,
      });
    });
  });

  describe('removeElementSilently', () => {
    test('should remove element without events', () => {
      const mockElement = { id: 'element1' };

      mockElementRegistry._elements['element1'] = {
        element: mockElement,
        gfx: 'mock-graphics',
      };

      silentModeling.removeElementSilently(mockElement);

      expect(mockCanvas._removeElement).toHaveBeenCalledWith(mockElement);
      expect(mockElementRegistry._elements['element1']).toBeUndefined();
    });
  });

  describe('createConnectionSilently', () => {
    test('should create connection without events', () => {
      const connectionData = {
        type: 'bpmn:SequenceFlow',
        businessObject: { id: 'flow1' },
      };

      const source = { id: 'source', x: 100, y: 100, width: 100, height: 80 };
      const target = { id: 'target', x: 300, y: 200, width: 100, height: 80 };

      const mockConnection = {
        id: 'flow1',
        type: 'bpmn:SequenceFlow',
        source: source,
        target: target,
      };

      mockElementFactory.createConnection.mockReturnValue(mockConnection);

      const result = silentModeling.createConnectionSilently(
        connectionData,
        source,
        target
      );

      expect(mockElementFactory.createConnection).toHaveBeenCalledWith({
        type: 'bpmn:SequenceFlow',
        businessObject: connectionData.businessObject,
        source: source,
        target: target,
        waypoints: [
          { x: 150, y: 140 }, // source center
          { x: 350, y: 240 }, // target center
        ],
      });

      expect(mockCanvas._addElement).toHaveBeenCalledWith(mockConnection, {
        id: 'root',
      });
      expect(result).toBe(mockConnection);
    });

    test('should use provided waypoints if available', () => {
      const connectionData = {
        type: 'bpmn:SequenceFlow',
        businessObject: { id: 'flow1' },
        waypoints: [
          { x: 100, y: 100 },
          { x: 200, y: 150 },
          { x: 300, y: 200 },
        ],
      };

      const source = { id: 'source' };
      const target = { id: 'target' };

      mockElementFactory.createConnection.mockReturnValue({ id: 'flow1' });

      silentModeling.createConnectionSilently(connectionData, source, target);

      expect(mockElementFactory.createConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          waypoints: [
            { x: 100, y: 100 },
            { x: 200, y: 150 },
            { x: 300, y: 200 },
          ],
        })
      );
    });
  });

  describe('executeBatchUpdatesSilently', () => {
    test('should execute batch updates with rendering suspension', () => {
      const updates = [
        {
          type: 'update' as const,
          element: { id: 'element1', businessObject: {} },
          data: { name: 'updated' },
        },
        {
          type: 'move' as const,
          element: { id: 'element2', x: 100, y: 100 },
          data: { x: 10, y: 20 },
        },
      ];

      mockElementRegistry.getGraphics.mockReturnValue('mock-graphics');

      silentModeling.executeBatchUpdatesSilently(updates);

      expect(mockCanvas._suspendRendering).toBe(false); // Should be restored
      expect(mockCanvas._redraw).toHaveBeenCalled();
      expect(updates[0].element.businessObject.name).toBe('updated');
      expect(updates[1].element.x).toBe(110);
      expect(updates[1].element.y).toBe(120);
    });

    test('should restore rendering even if updates throw error', () => {
      const updates = [
        {
          type: 'update' as const,
          element: null, // This will cause an error
          data: { name: 'updated' },
        },
      ];

      expect(() => {
        silentModeling.executeBatchUpdatesSilently(updates);
      }).toThrow();

      expect(mockCanvas._suspendRendering).toBe(false); // Should be restored
      expect(mockCanvas._redraw).toHaveBeenCalled();
    });
  });
});
