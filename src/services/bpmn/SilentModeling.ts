import { SilentCommandStack } from './SilentCommandStackModule';

// diagram-js 및 bpmn-js 타입 정의
interface EventBus {
  on(event: string | string[], callback: Function): void;
  off(event: string | string[], callback?: Function): void;
  fire(event: string, data?: any): any;
}

interface ElementFactory {
  createShape(attrs: any): any;
  createConnection(attrs: any): any;
}

interface Canvas {
  getRootElement(): any;
  getContainer(): HTMLElement;
  _addElement(element: any, parent?: any): void;
  _removeElement(element: any): void;
  _suspendRendering: boolean;
  _redraw(): void;
}

interface ElementRegistry {
  get(id: string): any;
  getGraphics(element: any): any;
  _elements: { [key: string]: { element: any; gfx: any } };
}

interface GraphicsFactory {
  create(type: string, element: any): any;
  update(type: string, element: any, gfx: any): void;
}

interface BpmnRules {
  allowed(action: string, context?: any): boolean;
}

/**
 * Silent Modeling 클래스
 * 협업용 모델링 작업을 이벤트 없이 수행
 */
export class SilentModeling {
  private eventBus: EventBus;
  private elementFactory: ElementFactory;
  private canvas: Canvas;
  private elementRegistry: ElementRegistry;
  private graphicsFactory: GraphicsFactory;
  private silentCommandStack: SilentCommandStack;
  private bpmnRules: BpmnRules;

  constructor(
    eventBus: EventBus,
    elementFactory: ElementFactory,
    canvas: Canvas,
    elementRegistry: ElementRegistry,
    graphicsFactory: GraphicsFactory,
    silentCommandStack: SilentCommandStack,
    bpmnRules: BpmnRules
  ) {
    this.eventBus = eventBus;
    this.elementFactory = elementFactory;
    this.canvas = canvas;
    this.elementRegistry = elementRegistry;
    this.graphicsFactory = graphicsFactory;
    this.silentCommandStack = silentCommandStack;
    this.bpmnRules = bpmnRules;
  }

  /**
   * 요소 속성을 Silent하게 업데이트
   */
  updatePropertiesSilently(element: any, properties: any): void {
    // BusinessObject 직접 수정
    Object.assign(element.businessObject, properties);

    // 그래픽스 업데이트 (이벤트 없음)
    this.updateGraphicsSilently(element);
  }

  /**
   * 요소 위치를 Silent하게 이동
   */
  moveElementSilently(element: any, delta: { x: number; y: number }): void {
    element.x += delta.x;
    element.y += delta.y;

    this.updateGraphicsSilently(element);
  }

  /**
   * 요소를 Silent하게 생성
   */
  createElementSilently(
    elementData: any,
    position: { x: number; y: number },
    parent?: any
  ): any {
    const element = this.elementFactory.createShape({
      type: elementData.type,
      businessObject: elementData.businessObject,
      x: position.x,
      y: position.y,
      width: elementData.width || 100,
      height: elementData.height || 80,
    });

    // Canvas에 직접 추가 (이벤트 없음)
    this.addElementToCanvasSilently(element, parent);

    return element;
  }

  /**
   * 요소를 Silent하게 삭제
   */
  removeElementSilently(element: any): void {
    // Canvas에서 직접 제거 (이벤트 없음)
    this.removeElementFromCanvasSilently(element);
  }

  /**
   * 연결을 Silent하게 생성
   */
  createConnectionSilently(connectionData: any, source: any, target: any): any {
    const connection = this.elementFactory.createConnection({
      type: connectionData.type,
      businessObject: connectionData.businessObject,
      source: source,
      target: target,
      waypoints: connectionData.waypoints || [
        { x: source.x + source.width / 2, y: source.y + source.height / 2 },
        { x: target.x + target.width / 2, y: target.y + target.height / 2 },
      ],
    });

    this.addElementToCanvasSilently(connection, this.canvas.getRootElement());

    return connection;
  }

  /**
   * 그래픽스를 Silent하게 업데이트
   */
  private updateGraphicsSilently(element: any): void {
    const gfx = this.elementRegistry.getGraphics(element);
    if (gfx) {
      // 그래픽스 직접 업데이트 (이벤트 없음)
      this.graphicsFactory.update('shape', element, gfx);
    }
  }

  /**
   * Canvas에 요소를 Silent하게 추가
   */
  private addElementToCanvasSilently(element: any, parent?: any): void {
    const targetParent = parent || this.canvas.getRootElement();

    // Canvas 내부 메서드 직접 호출 (이벤트 없음)
    (this.canvas as any)._addElement(element, targetParent);

    // ElementRegistry에 등록
    const gfx = this.graphicsFactory.create('shape', element);
    (this.elementRegistry as any)._elements[element.id] = {
      element: element,
      gfx: gfx,
    };
  }

  /**
   * Canvas에서 요소를 Silent하게 제거
   */
  private removeElementFromCanvasSilently(element: any): void {
    // Canvas 내부 메서드 직접 호출 (이벤트 없음)
    (this.canvas as any)._removeElement(element);

    // ElementRegistry에서 제거
    delete (this.elementRegistry as any)._elements[element.id];
  }

  /**
   * 배치 업데이트 실행 (성능 최적화)
   */
  executeBatchUpdatesSilently(
    updates: Array<{
      type: 'update' | 'move' | 'create' | 'remove';
      element?: any;
      data?: any;
    }>
  ): void {
    // 렌더링 일시 중단
    this.suspendRendering();

    try {
      updates.forEach(update => {
        switch (update.type) {
          case 'update':
            this.updatePropertiesSilently(update.element, update.data);
            break;
          case 'move':
            this.moveElementSilently(update.element, update.data);
            break;
          case 'create':
            this.createElementSilently(
              update.data.elementData,
              update.data.position,
              update.data.parent
            );
            break;
          case 'remove':
            this.removeElementSilently(update.element);
            break;
        }
      });
    } finally {
      // 렌더링 재개
      this.resumeRendering();
    }
  }

  /**
   * 렌더링 일시 중단
   */
  private suspendRendering(): void {
    (this.canvas as any)._suspendRendering = true;
  }

  /**
   * 렌더링 재개
   */
  private resumeRendering(): void {
    (this.canvas as any)._suspendRendering = false;
    (this.canvas as any)._redraw();
  }
}

/**
 * Silent Modeling 모듈 정의
 */
export const SilentModelingModule = {
  __init__: ['silentModeling'],
  silentModeling: ['type', SilentModeling],
};
