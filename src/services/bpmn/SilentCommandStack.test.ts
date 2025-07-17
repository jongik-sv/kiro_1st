import { SilentCommandStack } from './SilentCommandStackModule';
import EventBus from 'diagram-js/lib/core';

// Mock EventBus
class MockEventBus {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  fire(event: string, data?: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }
}

// Mock Injector
class MockInjector {
  get(name: string) {
    return {};
  }
}

describe('SilentCommandStack', () => {
  let silentCommandStack: SilentCommandStack;
  let mockEventBus: MockEventBus;
  let mockInjector: MockInjector;
  let eventsFired: string[];

  beforeEach(() => {
    mockEventBus = new MockEventBus();
    mockInjector = new MockInjector();
    eventsFired = [];

    // EventBus의 fire 메서드를 모니터링
    const originalFire = mockEventBus.fire.bind(mockEventBus);
    mockEventBus.fire = jest.fn((event: string, data?: any) => {
      eventsFired.push(event);
      return originalFire(event, data);
    });

    silentCommandStack = new SilentCommandStack(
      mockEventBus as any,
      mockInjector
    );
  });

  describe('Silent Mode', () => {
    test('setSilentMode should enable/disable silent mode', () => {
      expect((silentCommandStack as any)._silentMode).toBe(false);

      silentCommandStack.setSilentMode(true);
      expect((silentCommandStack as any)._silentMode).toBe(true);

      silentCommandStack.setSilentMode(false);
      expect((silentCommandStack as any)._silentMode).toBe(false);
    });

    test('fire method should not emit events in silent mode', () => {
      // Normal mode - events should fire
      (silentCommandStack as any).fire('test.event', {});
      expect(eventsFired).toContain('test.event');

      eventsFired.length = 0; // Clear events

      // Silent mode - events should not fire
      silentCommandStack.setSilentMode(true);
      (silentCommandStack as any).fire('test.event', {});
      expect(eventsFired).not.toContain('test.event');
    });
  });

  describe('Silent Execution', () => {
    test('executeSilently should temporarily enable silent mode', () => {
      // Mock execute method
      const mockExecute = jest.fn();
      (silentCommandStack as any).execute = mockExecute;

      expect((silentCommandStack as any)._silentMode).toBe(false);

      silentCommandStack.executeSilently('test.command', { data: 'test' });

      expect(mockExecute).toHaveBeenCalledWith('test.command', {
        data: 'test',
      });
      expect((silentCommandStack as any)._silentMode).toBe(false); // Should restore original state
    });

    test('executeSilently should preserve existing silent mode', () => {
      // Mock execute method
      const mockExecute = jest.fn();
      (silentCommandStack as any).execute = mockExecute;

      silentCommandStack.setSilentMode(true);
      expect((silentCommandStack as any)._silentMode).toBe(true);

      silentCommandStack.executeSilently('test.command', { data: 'test' });

      expect(mockExecute).toHaveBeenCalledWith('test.command', {
        data: 'test',
      });
      expect((silentCommandStack as any)._silentMode).toBe(true); // Should preserve silent mode
    });

    test('executeBatchSilently should execute multiple commands silently', () => {
      // Mock execute method
      const mockExecute = jest.fn().mockReturnValue('result');
      (silentCommandStack as any).execute = mockExecute;

      const commands = [
        { command: 'command1', context: { data: 'test1' } },
        { command: 'command2', context: { data: 'test2' } },
        { command: 'command3' },
      ];

      const results = silentCommandStack.executeBatchSilently(commands);

      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockExecute).toHaveBeenNthCalledWith(1, 'command1', {
        data: 'test1',
      });
      expect(mockExecute).toHaveBeenNthCalledWith(2, 'command2', {
        data: 'test2',
      });
      expect(mockExecute).toHaveBeenNthCalledWith(3, 'command3', undefined);
      expect(results).toEqual(['result', 'result', 'result']);
      expect((silentCommandStack as any)._silentMode).toBe(false); // Should restore original state
    });
  });

  describe('Error Handling', () => {
    test('executeSilently should restore silent mode even if execution throws', () => {
      // Mock execute method to throw error
      const mockExecute = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      (silentCommandStack as any).execute = mockExecute;

      expect((silentCommandStack as any)._silentMode).toBe(false);

      expect(() => {
        silentCommandStack.executeSilently('test.command');
      }).toThrow('Test error');

      expect((silentCommandStack as any)._silentMode).toBe(false); // Should restore original state
    });

    test('executeBatchSilently should restore silent mode even if execution throws', () => {
      // Mock execute method to throw error on second command
      const mockExecute = jest
        .fn()
        .mockReturnValueOnce('result1')
        .mockImplementationOnce(() => {
          throw new Error('Test error');
        });
      (silentCommandStack as any).execute = mockExecute;

      const commands = [{ command: 'command1' }, { command: 'command2' }];

      expect(() => {
        silentCommandStack.executeBatchSilently(commands);
      }).toThrow('Test error');

      expect((silentCommandStack as any)._silentMode).toBe(false); // Should restore original state
    });
  });
});
