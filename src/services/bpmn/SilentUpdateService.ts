/**
 * SilentUpdateService - 핵심 협업 메커니즘
 * 
 * bpmn-js 협업 시스템의 핵심으로, 원격 변경사항을 로컬 모델에 반영하되 
 * commandStack이나 element 이벤트를 발생시키지 않는 "Silent Update" 메커니즘을 제공합니다.
 */

// bpmn-js 및 diagram-js 타입 정의
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
  _elements: { [key: string]: { element: any, gfx: any } };
}

interface GraphicsFactory {
  create(type: string, element: any): any;
  update(type: string, element: any, gfx: any): void;
}

interface BpmnFactory {
  create(type: string, attrs?: any): any;
}

interface ElementFactory {
  createShape(attrs: any): any;
  createConnection(attrs: any): any;
}

interface BpmnModeler {
  get(service: string): any;
}

/**
 * Silent Update 작업 타입 정의
 */
export interface SilentUpdateOperation {
  type: 'business' | 'visual' | 'create' | 'remove';
  elementId?: string;
  data?: any;
}

/**
 * SilentUpdateService 클래스
 * 
 * bpmn-js의 내부 구조를 직접 조작하여 이벤트 없이 모델을 업데이트하는 서비스
 */
export class SilentUpdateService {
  private canvas: Canvas;
  private elementRegistry: ElementRegistry;
  private graphicsFactory: GraphicsFactory;
  private bpmnFactory: BpmnFactory;
  private elementFactory: ElementFactory;
  private modeler: BpmnModeler;

  constructor(modeler: BpmnModeler) {
    this.modeler = modeler;
    this.canvas = modeler.get('canvas');
    this.elementRegistry = modeler.get('elementRegistry');
    this.graphicsFactory = modeler.get('graphicsFactory');
    this.bpmnFactory = modeler.get('bpmnFactory');
    this.elementFactory = modeler.get('elementFactory');
  }

  // ==================== BusinessObject 직접 조작 메서드 ====================

  /**
   * BusinessObject 직접 업데이트 (이벤트 없음)
   * 
   * @param elementId 업데이트할 요소의 ID
   * @param properties 업데이트할 속성들
   * @returns 업데이트된 요소 또는 null
   */
  updateBusinessObjectDirectly(elementId: string, properties: any): any | null {
    const element = this.elementRegistry.get(elementId);
    if (!element || !element.businessObject) {
      console.warn(`Element with ID ${elementId} not found or has no businessObject`);
      return null;
    }

    // BusinessObject 직접 수정
    Object.assign(element.businessObject, properties);

    // 그래픽스 업데이트 (이벤트 없음)
    this.updateGraphicsSilently(element);

    return element;
  }

  /**
   * BusinessObject 속성 직접 설정
   * 
   * @param elementId 요소 ID
   * @param propertyPath 속성 경로 (예: 'name', 'documentation[0].text')
   * @param value 설정할 값
   */
  setBusinessObjectProperty(elementId: string, propertyPath: string, value: any): boolean {
    const element = this.elementRegistry.get(elementId);
    if (!element || !element.businessObject) {
      return false;
    }

    // 중첩된 속성 경로 처리
    const pathParts = propertyPath.split('.');
    let target = element.businessObject;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!target[part]) {
        target[part] = {};
      }
      target = target[part];
    }

    const finalProperty = pathParts[pathParts.length - 1];
    target[finalProperty] = value;

    this.updateGraphicsSilently(element);
    return true;
  }

  /**
   * BusinessObject 트리 구조 직접 설정
   * 
   * @param elementId 요소 ID
   * @param parentElementId 부모 요소 ID
   */
  setBusinessObjectParent(elementId: string, parentElementId: string): boolean {
    const element = this.elementRegistry.get(elementId);
    const parentElement = this.elementRegistry.get(parentElementId);

    if (!element || !parentElement || !element.businessObject || !parentElement.businessObject) {
      return false;
    }

    // 부모-자식 관계 직접 설정
    element.businessObject.$parent = parentElement.businessObject;

    // 부모의 children 배열에 추가 (존재하는 경우)
    if (parentElement.businessObject.flowElements) {
      if (!parentElement.businessObject.flowElements.includes(element.businessObject)) {
        parentElement.businessObject.flowElements.push(element.businessObject);
      }
    }

    return true;
  }

  // ==================== Canvas 직접 요소 추가/제거 메서드 ====================

  /**
   * Canvas에 직접 요소 추가 (이벤트 없음)
   * 
   * @param elementData 요소 데이터
   * @param parent 부모 요소 (선택사항)
   * @returns 생성된 요소
   */
  addElementSilently(elementData: any, parent?: any): any {
    // BusinessObject 생성
    const businessObject = this.bpmnFactory.create(elementData.type, elementData.properties || {});

    // 요소 생성
    const element = this.elementFactory.createShape({
      type: elementData.type,
      businessObject: businessObject,
      x: elementData.x || 0,
      y: elementData.y || 0,
      width: elementData.width || 100,
      height: elementData.height || 80
    });

    // ID 설정
    if (elementData.id) {
      element.id = elementData.id;
      businessObject.id = elementData.id;
    }

    // Canvas에 직접 추가
    const targetParent = parent || this.canvas.getRootElement();
    (this.canvas as any)._addElement(element, targetParent);

    // ElementRegistry에 그래픽스와 함께 등록
    const gfx = this.graphicsFactory.create('shape', element);
    (this.elementRegistry as any)._elements[element.id] = {
      element: element,
      gfx: gfx
    };

    return element;
  }

  /**
   * Canvas에서 직접 요소 제거 (이벤트 없음)
   * 
   * @param elementId 제거할 요소의 ID
   */
  removeElementSilently(elementId: string): boolean {
    const element = this.elementRegistry.get(elementId);
    if (!element) {
      console.warn(`Element with ID ${elementId} not found`);
      return false;
    }

    // 연결된 요소들도 함께 제거 (incoming/outgoing connections)
    const connections = [...(element.incoming || []), ...(element.outgoing || [])];
    connections.forEach(connection => {
      if (connection.id !== elementId) {
        this.removeElementSilently(connection.id);
      }
    });

    // Canvas에서 직접 제거
    (this.canvas as any)._removeElement(element);

    // ElementRegistry에서 제거
    delete (this.elementRegistry as any)._elements[elementId];

    return true;
  }

  /**
   * 연결 요소를 직접 생성
   * 
   * @param connectionData 연결 데이터
   * @param sourceId 소스 요소 ID
   * @param targetId 타겟 요소 ID
   * @returns 생성된 연결 요소
   */
  addConnectionSilently(connectionData: any, sourceId: string, targetId: string): any {
    const source = this.elementRegistry.get(sourceId);
    const target = this.elementRegistry.get(targetId);

    if (!source || !target) {
      console.warn(`Source (${sourceId}) or target (${targetId}) element not found`);
      return null;
    }

    // BusinessObject 생성
    const businessObject = this.bpmnFactory.create(connectionData.type, connectionData.properties || {});

    // 연결 요소 생성
    const connection = this.elementFactory.createConnection({
      type: connectionData.type,
      businessObject: businessObject,
      source: source,
      target: target,
      waypoints: connectionData.waypoints || [
        { x: source.x + source.width / 2, y: source.y + source.height / 2 },
        { x: target.x + target.width / 2, y: target.y + target.height / 2 }
      ]
    });

    // ID 설정
    if (connectionData.id) {
      connection.id = connectionData.id;
      businessObject.id = connectionData.id;
    }

    // BusinessObject에 source/target 참조 설정
    businessObject.sourceRef = source.businessObject;
    businessObject.targetRef = target.businessObject;

    // Canvas에 직접 추가
    (this.canvas as any)._addElement(connection, this.canvas.getRootElement());

    // ElementRegistry에 등록
    const gfx = this.graphicsFactory.create('connection', connection);
    (this.elementRegistry as any)._elements[connection.id] = {
      element: connection,
      gfx: gfx
    };

    // 소스와 타겟 요소의 연결 정보 업데이트
    if (!source.outgoing) source.outgoing = [];
    if (!target.incoming) target.incoming = [];
    
    source.outgoing.push(connection);
    target.incoming.push(connection);

    return connection;
  }

  // ==================== 시각적 속성 직접 업데이트 ====================

  /**
   * 시각적 속성 직접 업데이트
   * 
   * @param elementId 요소 ID
   * @param visualProps 시각적 속성들 (x, y, width, height 등)
   * @returns 업데이트된 요소 또는 null
   */
  updateVisualPropertiesDirectly(elementId: string, visualProps: any): any | null {
    const element = this.elementRegistry.get(elementId);
    if (!element) {
      console.warn(`Element with ID ${elementId} not found`);
      return null;
    }

    // 시각적 속성 직접 수정
    Object.assign(element, visualProps);

    // 그래픽스 업데이트
    this.updateGraphicsSilently(element);

    return element;
  }

  /**
   * 요소 위치 직접 설정
   * 
   * @param elementId 요소 ID
   * @param x X 좌표
   * @param y Y 좌표
   */
  setElementPosition(elementId: string, x: number, y: number): boolean {
    return this.updateVisualPropertiesDirectly(elementId, { x, y }) !== null;
  }

  /**
   * 요소 크기 직접 설정
   * 
   * @param elementId 요소 ID
   * @param width 너비
   * @param height 높이
   */
  setElementSize(elementId: string, width: number, height: number): boolean {
    return this.updateVisualPropertiesDirectly(elementId, { width, height }) !== null;
  }

  // ==================== 그래픽스 강제 업데이트 및 렌더링 제어 ====================

  /**
   * 그래픽스 강제 업데이트 (이벤트 없음)
   * 
   * @param element 업데이트할 요소
   */
  private updateGraphicsSilently(element: any): void {
    const gfx = this.elementRegistry.getGraphics(element);
    if (gfx) {
      const elementType = element.waypoints ? 'connection' : 'shape';
      this.graphicsFactory.update(elementType, element, gfx);
    }
  }

  /**
   * 특정 요소의 그래픽스 강제 새로고침
   * 
   * @param elementId 요소 ID
   */
  refreshElementGraphics(elementId: string): boolean {
    const element = this.elementRegistry.get(elementId);
    if (!element) {
      return false;
    }

    this.updateGraphicsSilently(element);
    return true;
  }

  /**
   * 모든 요소의 그래픽스 강제 새로고침
   */
  refreshAllGraphics(): void {
    const elements = (this.elementRegistry as any)._elements;
    Object.values(elements).forEach((entry: any) => {
      this.updateGraphicsSilently(entry.element);
    });
  }

  /**
   * 렌더링 일시 중단
   */
  suspendRendering(): void {
    (this.canvas as any)._suspendRendering = true;
  }

  /**
   * 렌더링 재개 및 강제 새로고침
   */
  resumeRendering(): void {
    (this.canvas as any)._suspendRendering = false;
    (this.canvas as any)._redraw();
  }

  /**
   * 렌더링 상태 확인
   */
  isRenderingSuspended(): boolean {
    return (this.canvas as any)._suspendRendering === true;
  }
 
 // ==================== 배치 업데이트 시스템 (성능 최적화) ====================

  /**
   * 배치 업데이트 실행 (렌더링 최적화)
   * 
   * @param updates 업데이트 작업 배열
   */
  batchUpdate(updates: SilentUpdateOperation[]): void {
    if (updates.length === 0) {
      return;
    }

    // 렌더링 일시 중단
    this.suspendRendering();

    try {
      updates.forEach(update => {
        switch (update.type) {
          case 'business':
            if (update.elementId && update.data) {
              this.updateBusinessObjectDirectly(update.elementId, update.data);
            }
            break;

          case 'visual':
            if (update.elementId && update.data) {
              this.updateVisualPropertiesDirectly(update.elementId, update.data);
            }
            break;

          case 'create':
            if (update.data) {
              if (update.data.connectionData && update.data.sourceId && update.data.targetId) {
                // 연결 생성
                this.addConnectionSilently(update.data.connectionData, update.data.sourceId, update.data.targetId);
              } else {
                // 일반 요소 생성
                this.addElementSilently(update.data, update.data.parent);
              }
            }
            break;

          case 'remove':
            if (update.elementId) {
              this.removeElementSilently(update.elementId);
            }
            break;

          default:
            console.warn(`Unknown update type: ${update.type}`);
        }
      });
    } finally {
      // 렌더링 재개
      this.resumeRendering();
    }
  }

  /**
   * 배치 업데이트 (타입별 그룹화로 성능 최적화)
   * 
   * @param updates 업데이트 작업 배열
   */
  batchUpdateOptimized(updates: SilentUpdateOperation[]): void {
    if (updates.length === 0) {
      return;
    }

    // 타입별로 그룹화
    const groupedUpdates = {
      business: updates.filter(u => u.type === 'business'),
      visual: updates.filter(u => u.type === 'visual'),
      create: updates.filter(u => u.type === 'create'),
      remove: updates.filter(u => u.type === 'remove')
    };

    this.suspendRendering();

    try {
      // 1. 먼저 생성 작업 수행
      groupedUpdates.create.forEach(update => {
        if (update.data) {
          if (update.data.connectionData && update.data.sourceId && update.data.targetId) {
            this.addConnectionSilently(update.data.connectionData, update.data.sourceId, update.data.targetId);
          } else {
            this.addElementSilently(update.data, update.data.parent);
          }
        }
      });

      // 2. BusinessObject 업데이트 수행
      groupedUpdates.business.forEach(update => {
        if (update.elementId && update.data) {
          this.updateBusinessObjectDirectly(update.elementId, update.data);
        }
      });

      // 3. 시각적 속성 업데이트 수행
      groupedUpdates.visual.forEach(update => {
        if (update.elementId && update.data) {
          this.updateVisualPropertiesDirectly(update.elementId, update.data);
        }
      });

      // 4. 마지막으로 삭제 작업 수행
      groupedUpdates.remove.forEach(update => {
        if (update.elementId) {
          this.removeElementSilently(update.elementId);
        }
      });

    } finally {
      this.resumeRendering();
    }
  }

  /**
   * 대용량 배치 업데이트 (청크 단위로 처리)
   * 
   * @param updates 업데이트 작업 배열
   * @param chunkSize 청크 크기 (기본값: 50)
   */
  async batchUpdateLarge(updates: SilentUpdateOperation[], chunkSize: number = 50): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    // 청크 단위로 분할
    const chunks: SilentUpdateOperation[][] = [];
    for (let i = 0; i < updates.length; i += chunkSize) {
      chunks.push(updates.slice(i, i + chunkSize));
    }

    // 각 청크를 순차적으로 처리 (메모리 사용량 제한)
    for (const chunk of chunks) {
      this.batchUpdateOptimized(chunk);
      
      // 다음 청크 처리 전 잠시 대기 (UI 블로킹 방지)
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  // ==================== 유틸리티 메서드 ====================

  /**
   * 요소 존재 여부 확인
   * 
   * @param elementId 요소 ID
   * @returns 존재 여부
   */
  elementExists(elementId: string): boolean {
    return this.elementRegistry.get(elementId) !== undefined;
  }

  /**
   * 모든 요소 ID 목록 반환
   * 
   * @returns 요소 ID 배열
   */
  getAllElementIds(): string[] {
    const elements = (this.elementRegistry as any)._elements;
    return Object.keys(elements);
  }

  /**
   * 요소 타입별 개수 반환
   * 
   * @returns 타입별 개수 객체
   */
  getElementCountByType(): { [type: string]: number } {
    const elements = (this.elementRegistry as any)._elements;
    const counts: { [type: string]: number } = {};

    Object.values(elements).forEach((entry: any) => {
      const element = entry.element;
      const type = element.businessObject?.$type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    });

    return counts;
  }

  /**
   * 메모리 정리 (사용하지 않는 참조 제거)
   */
  cleanup(): void {
    // 현재는 특별한 정리 작업이 필요하지 않음
    // 필요시 향후 확장 가능
  }

  /**
   * 서비스 상태 정보 반환
   */
  getServiceInfo(): {
    elementCount: number;
    isRenderingSuspended: boolean;
    elementTypes: { [type: string]: number };
  } {
    return {
      elementCount: this.getAllElementIds().length,
      isRenderingSuspended: this.isRenderingSuspended(),
      elementTypes: this.getElementCountByType()
    };
  }
}

/**
 * SilentUpdateService 모듈 정의
 */
export const SilentUpdateServiceModule = {
  __init__: ['silentUpdateService'],
  silentUpdateService: ['type', SilentUpdateService]
};