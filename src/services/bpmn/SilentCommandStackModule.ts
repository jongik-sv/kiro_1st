// diagram-js 타입 정의
interface EventBus {
  on(event: string | string[], callback: Function): void;
  off(event: string | string[], callback?: Function): void;
  fire(event: string, data?: any): any;
}

/**
 * Silent CommandStack Module
 * 협업용 별도 CommandStack으로, 원격 변경사항 적용 시 이벤트를 발생시키지 않음
 */
export class SilentCommandStack {
  private _silentMode: boolean = false;
  private eventBus: EventBus;
  private injector: any;
  private _stack: any[] = [];
  private _stackIdx: number = -1;
  private _handlers: Map<string, any> = new Map();

  constructor(eventBus: EventBus, injector: any) {
    this.eventBus = eventBus;
    this.injector = injector;
  }

  /**
   * Silent 모드 활성화/비활성화
   */
  setSilentMode(silent: boolean): void {
    this._silentMode = silent;
  }

  /**
   * 명령 핸들러 등록
   */
  registerHandler(command: string, handler: any): void {
    this._handlers.set(command, handler);
  }

  /**
   * 명령 실행
   */
  execute(command: string, context?: any): any {
    const handler = this._handlers.get(command);
    if (!handler) {
      throw new Error(`No handler registered for command: ${command}`);
    }

    const result = handler.execute ? handler.execute(context) : handler(context);
    
    if (!this._silentMode) {
      this.fire('commandStack.changed', { command, context, result });
    }
    
    return result;
  }

  /**
   * Silent 모드에서는 이벤트를 발생시키지 않음
   */
  protected fire(type: string, event: any): void {
    if (this._silentMode) {
      return; // Silent 모드에서는 이벤트 발생 억제
    }
    this.eventBus.fire(type, event);
  }

  /**
   * Silent 모드에서 명령 실행
   */
  executeSilently(command: string, context?: any): any {
    const wasSilent = this._silentMode;
    this._silentMode = true;
    
    try {
      return this.execute(command, context);
    } finally {
      this._silentMode = wasSilent;
    }
  }

  /**
   * Silent 모드에서 여러 명령을 배치 실행
   */
  executeBatchSilently(commands: Array<{command: string, context?: any}>): any[] {
    const wasSilent = this._silentMode;
    this._silentMode = true;
    
    try {
      return commands.map(({command, context}) => this.execute(command, context));
    } finally {
      this._silentMode = wasSilent;
    }
  }
}

/**
 * Silent CommandStack 모듈 정의
 */
export const SilentCommandStackModule = {
  __init__: ['silentCommandStack'],
  silentCommandStack: ['type', SilentCommandStack]
};