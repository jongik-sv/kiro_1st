/**
 * CollaborationEventManager - 무한 루프 방지 시스템
 *
 * bpmn-js 협업 시스템에서 로컬 변경사항과 원격 변경사항을 구분하여 처리하고,
 * 무한 루프를 방지하는 핵심 이벤트 관리 시스템입니다.
 */

import {
  EventBus,
  ElementChangeEvent,
  SilentUpdateService,
} from '../../types/bpmn';

/**
 * 변경사항 타입 정의
 */
export interface ChangeEvent {
  type: 'property' | 'position' | 'create' | 'remove' | 'connection';
  elementId: string;
  elementType?: string;
  properties?: any;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  elementData?: any;
  sourceId?: string;
  targetId?: string;
  timestamp: number;
  userId?: string;
  isRemote?: boolean;
}

/**
 * 이벤트 소스 추적 정보
 */
interface EventSourceInfo {
  elementId: string;
  timestamp: number;
  source: 'local' | 'remote';
  processed: boolean;
}

/**
 * 변경사항 추적 정보
 */
interface ChangeTrackingInfo {
  elementId: string;
  lastChange: any;
  changeCount: number;
  lastTimestamp: number;
}

/**
 * CollaborationEventManager 클래스
 *
 * 로컬과 원격 이벤트를 구분하여 처리하고 무한 루프를 방지하는 시스템
 */
export class CollaborationEventManager {
  private modeler: any;
  private eventBus: EventBus;
  private silentUpdateService: SilentUpdateService;

  // 무한 루프 방지를 위한 플래그들
  private isProcessingRemoteEvent = false;
  private remoteEventSources = new Set<string>();
  private changeTracker = new Map<string, ChangeTrackingInfo>();

  // 이벤트 소스 추적
  private eventSourceHistory = new Map<string, EventSourceInfo>();
  private readonly EVENT_SOURCE_TTL = 5000; // 5초

  // 변경사항 디바운싱
  private changeBuffer = new Map<string, ChangeEvent>();
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 100; // 100ms

  // 이벤트 콜백들
  private onLocalChangeCallback?: (change: ChangeEvent) => void;
  private onRemoteChangeCallback?: (change: ChangeEvent) => void;

  constructor(modeler: any, silentUpdateService: SilentUpdateService) {
    this.modeler = modeler;
    this.silentUpdateService = silentUpdateService;

    // EventBus 가져오기 (null 체크 포함)
    this.eventBus = modeler.get('eventBus');
    if (!this.eventBus) {
      throw new Error('EventBus not found in modeler');
    }

    this.setupEventListeners();
    this.startCleanupTimer();
  }

  // ==================== 이벤트 리스너 설정 ====================

  /**
   * bpmn-js 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // 요소 변경 이벤트 감지
    this.eventBus.on('element.changed', (event: any) => {
      if (this.shouldIgnoreEvent(event)) {
        return;
      }

      this.handleElementChanged(event);
    });

    // CommandStack 변경 이벤트 감지
    this.eventBus.on('commandStack.changed', (event: any) => {
      if (this.shouldIgnoreEvent(event)) {
        return;
      }

      this.handleCommandStackChanged(event);
    });

    // 요소 생성/삭제 이벤트
    this.eventBus.on(['shape.added', 'connection.added'], (event: any) => {
      if (this.shouldIgnoreEvent(event)) {
        return;
      }

      this.handleElementAdded(event);
    });

    this.eventBus.on(['shape.removed', 'connection.removed'], (event: any) => {
      if (this.shouldIgnoreEvent(event)) {
        return;
      }

      this.handleElementRemoved(event);
    });

    // 요소 이동 이벤트
    this.eventBus.on(['shape.moved', 'connection.moved'], (event: any) => {
      if (this.shouldIgnoreEvent(event)) {
        return;
      }

      this.handleElementMoved(event);
    });
  }

  /**
   * 이벤트 무시 여부 판단
   */
  private shouldIgnoreEvent(event: any): boolean {
    // 원격 이벤트 처리 중인 경우 무시
    if (this.isProcessingRemoteEvent) {
      return true;
    }

    // 원격 이벤트 소스로 표시된 요소인 경우 무시
    if (event.element && this.remoteEventSources.has(event.element.id)) {
      this.remoteEventSources.delete(event.element.id);
      return true;
    }

    // 최근에 원격에서 처리된 이벤트인 경우 무시
    if (event.element && this.isRecentRemoteEvent(event.element.id)) {
      return true;
    }

    return false;
  }

  /**
   * 최근 원격 이벤트 여부 확인
   */
  private isRecentRemoteEvent(elementId: string): boolean {
    const sourceInfo = this.eventSourceHistory.get(elementId);
    if (!sourceInfo) {
      return false;
    }

    const now = Date.now();
    const isRecent = now - sourceInfo.timestamp < this.EVENT_SOURCE_TTL;
    const isRemote = sourceInfo.source === 'remote';

    return isRecent && isRemote && !sourceInfo.processed;
  }

  // ==================== 로컬 이벤트 처리 ====================

  /**
   * 요소 변경 이벤트 처리
   */
  private handleElementChanged(event: any): void {
    const element = event.element;
    if (!element || !element.id) {
      return;
    }

    const changeEvent: ChangeEvent = {
      type: 'property',
      elementId: element.id,
      elementType: element.businessObject?.$type,
      properties: this.extractElementProperties(element),
      timestamp: Date.now(),
    };

    this.trackLocalChange(changeEvent);
    this.debounceLocalChange(changeEvent);
  }

  /**
   * CommandStack 변경 이벤트 처리
   */
  private handleCommandStackChanged(event: any): void {
    // CommandStack 변경사항을 분석하여 실제 변경된 요소들 추출
    const changes = this.extractCommandStackChanges(event);

    changes.forEach(change => {
      this.trackLocalChange(change);
      this.debounceLocalChange(change);
    });
  }

  /**
   * 요소 추가 이벤트 처리
   */
  private handleElementAdded(event: any): void {
    const element = event.element;
    if (!element || !element.id) {
      return;
    }

    const changeEvent: ChangeEvent = {
      type: 'create',
      elementId: element.id,
      elementType: element.businessObject?.$type,
      elementData: this.extractElementData(element),
      timestamp: Date.now(),
    };

    this.trackLocalChange(changeEvent);
    this.broadcastLocalChange(changeEvent);
  }

  /**
   * 요소 제거 이벤트 처리
   */
  private handleElementRemoved(event: any): void {
    const element = event.element;
    if (!element || !element.id) {
      return;
    }

    const changeEvent: ChangeEvent = {
      type: 'remove',
      elementId: element.id,
      elementType: element.businessObject?.$type,
      timestamp: Date.now(),
    };

    this.trackLocalChange(changeEvent);
    this.broadcastLocalChange(changeEvent);
  }

  /**
   * 요소 이동 이벤트 처리
   */
  private handleElementMoved(event: any): void {
    const element = event.element;
    if (!element || !element.id) {
      return;
    }

    const changeEvent: ChangeEvent = {
      type: 'position',
      elementId: element.id,
      elementType: element.businessObject?.$type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      timestamp: Date.now(),
    };

    this.trackLocalChange(changeEvent);
    this.debounceLocalChange(changeEvent);
  }

  // ==================== 원격 이벤트 처리 ====================

  /**
   * 원격 변경사항 적용 (무한 루프 방지)
   */
  applyRemoteChanges(changes: ChangeEvent[]): void {
    if (changes.length === 0) {
      return;
    }

    // 원격 이벤트 처리 플래그 설정
    this.isProcessingRemoteEvent = true;

    try {
      // 변경사항을 타입별로 그룹화하여 효율적으로 처리
      const groupedChanges = this.groupChangesByType(changes);

      // 렌더링 일시 중단 (성능 최적화)
      this.silentUpdateService.suspendRendering();

      try {
        // 1. 생성 작업 먼저 처리
        this.processRemoteCreations(groupedChanges.create || []);

        // 2. 속성 변경 처리
        this.processRemotePropertyChanges(groupedChanges.property || []);

        // 3. 위치 변경 처리
        this.processRemotePositionChanges(groupedChanges.position || []);

        // 4. 삭제 작업 마지막에 처리
        this.processRemoteRemovals(groupedChanges.remove || []);
      } finally {
        // 렌더링 재개
        this.silentUpdateService.resumeRendering();
      }

      // 원격 이벤트 소스 추적 정보 업데이트
      changes.forEach(change => {
        this.markAsRemoteEvent(change.elementId);
        this.trackRemoteChange(change);
      });
    } finally {
      // 원격 이벤트 처리 플래그 해제
      this.isProcessingRemoteEvent = false;
    }
  }

  /**
   * 변경사항을 타입별로 그룹화
   */
  private groupChangesByType(changes: ChangeEvent[]): {
    [type: string]: ChangeEvent[];
  } {
    const grouped: { [type: string]: ChangeEvent[] } = {};

    changes.forEach(change => {
      if (!grouped[change.type]) {
        grouped[change.type] = [];
      }
      grouped[change.type].push(change);
    });

    return grouped;
  }

  /**
   * 원격 생성 작업 처리
   */
  private processRemoteCreations(changes: ChangeEvent[]): void {
    changes.forEach(change => {
      if (change.elementData) {
        this.silentUpdateService.addElementSilently(change.elementData);
      }
    });
  }

  /**
   * 원격 속성 변경 처리
   */
  private processRemotePropertyChanges(changes: ChangeEvent[]): void {
    changes.forEach(change => {
      if (change.properties) {
        this.silentUpdateService.updateBusinessObjectDirectly(
          change.elementId,
          change.properties
        );
      }
    });
  }

  /**
   * 원격 위치 변경 처리
   */
  private processRemotePositionChanges(changes: ChangeEvent[]): void {
    changes.forEach(change => {
      const visualProps: any = {};

      if (change.x !== undefined) visualProps.x = change.x;
      if (change.y !== undefined) visualProps.y = change.y;
      if (change.width !== undefined) visualProps.width = change.width;
      if (change.height !== undefined) visualProps.height = change.height;

      if (Object.keys(visualProps).length > 0) {
        this.silentUpdateService.updateVisualPropertiesDirectly(
          change.elementId,
          visualProps
        );
      }
    });
  }

  /**
   * 원격 삭제 작업 처리
   */
  private processRemoteRemovals(changes: ChangeEvent[]): void {
    changes.forEach(change => {
      this.silentUpdateService.removeElementSilently(change.elementId);
    });
  }

  // ==================== 변경사항 추적 및 중복 방지 ====================

  /**
   * 로컬 변경사항 추적
   */
  private trackLocalChange(change: ChangeEvent): void {
    const trackingInfo: ChangeTrackingInfo = {
      elementId: change.elementId,
      lastChange: change,
      changeCount:
        (this.changeTracker.get(change.elementId)?.changeCount || 0) + 1,
      lastTimestamp: change.timestamp,
    };

    this.changeTracker.set(change.elementId, trackingInfo);

    // 이벤트 소스 히스토리 업데이트
    this.eventSourceHistory.set(change.elementId, {
      elementId: change.elementId,
      timestamp: change.timestamp,
      source: 'local',
      processed: false,
    });
  }

  /**
   * 원격 변경사항 추적
   */
  private trackRemoteChange(change: ChangeEvent): void {
    // 이벤트 소스 히스토리 업데이트
    this.eventSourceHistory.set(change.elementId, {
      elementId: change.elementId,
      timestamp: change.timestamp,
      source: 'remote',
      processed: true,
    });

    // 원격 변경사항 콜백 호출
    if (this.onRemoteChangeCallback) {
      this.onRemoteChangeCallback(change);
    }
  }

  /**
   * 원격 이벤트 소스로 표시
   */
  private markAsRemoteEvent(elementId: string): void {
    this.remoteEventSources.add(elementId);

    // 일정 시간 후 자동 제거 (메모리 누수 방지)
    setTimeout(() => {
      this.remoteEventSources.delete(elementId);
    }, this.EVENT_SOURCE_TTL);
  }

  /**
   * 중복 변경사항 감지
   */
  private isDuplicateChange(change: ChangeEvent): boolean {
    const trackingInfo = this.changeTracker.get(change.elementId);
    if (!trackingInfo) {
      return false;
    }

    // 같은 타입의 변경사항이 짧은 시간 내에 발생한 경우
    const timeDiff = change.timestamp - trackingInfo.lastTimestamp;
    const isSameType = trackingInfo.lastChange.type === change.type;
    const isRecent = timeDiff < 50; // 50ms 이내

    return isSameType && isRecent;
  }

  // ==================== 디바운싱 및 배치 처리 ====================

  /**
   * 로컬 변경사항 디바운싱
   */
  private debounceLocalChange(change: ChangeEvent): void {
    // 중복 변경사항 필터링
    if (this.isDuplicateChange(change)) {
      return;
    }

    // 버퍼에 변경사항 추가
    this.changeBuffer.set(change.elementId, change);

    // 기존 타이머 취소
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 새 타이머 설정
    this.debounceTimer = setTimeout(() => {
      this.flushChangeBuffer();
    }, this.DEBOUNCE_DELAY);
  }

  /**
   * 변경사항 버퍼 플러시
   */
  private flushChangeBuffer(): void {
    const changes = Array.from(this.changeBuffer.values());
    this.changeBuffer.clear();
    this.debounceTimer = null;

    // 배치로 브로드캐스트
    if (changes.length > 0) {
      this.broadcastLocalChanges(changes);
    }
  }

  /**
   * 로컬 변경사항 브로드캐스트 (단일)
   */
  private broadcastLocalChange(change: ChangeEvent): void {
    if (this.onLocalChangeCallback) {
      this.onLocalChangeCallback(change);
    }
  }

  /**
   * 로컬 변경사항 브로드캐스트 (배치)
   */
  private broadcastLocalChanges(changes: ChangeEvent[]): void {
    changes.forEach(change => {
      this.broadcastLocalChange(change);
    });
  }

  // ==================== 데이터 추출 유틸리티 ====================

  /**
   * 요소 속성 추출
   */
  private extractElementProperties(element: any): any {
    if (!element.businessObject) {
      return {};
    }

    const businessObject = element.businessObject;
    const properties: any = {};

    // 기본 속성들
    if (businessObject.name !== undefined)
      properties.name = businessObject.name;
    if (businessObject.documentation)
      properties.documentation = businessObject.documentation;

    // BPMN 특화 속성들
    if (businessObject.assignee) properties.assignee = businessObject.assignee;
    if (businessObject.candidateUsers)
      properties.candidateUsers = businessObject.candidateUsers;
    if (businessObject.candidateGroups)
      properties.candidateGroups = businessObject.candidateGroups;
    if (businessObject.formKey) properties.formKey = businessObject.formKey;
    if (businessObject.priority) properties.priority = businessObject.priority;
    if (businessObject.dueDate) properties.dueDate = businessObject.dueDate;

    return properties;
  }

  /**
   * 요소 데이터 추출
   */
  private extractElementData(element: any): any {
    return {
      id: element.id,
      type: element.businessObject?.$type || element.type,
      x: element.x || 0,
      y: element.y || 0,
      width: element.width || 100,
      height: element.height || 80,
      properties: this.extractElementProperties(element),
    };
  }

  /**
   * CommandStack 변경사항 추출
   */
  private extractCommandStackChanges(event: any): ChangeEvent[] {
    const changes: ChangeEvent[] = [];

    // CommandStack 이벤트에서 실제 변경된 요소들을 추출
    // 이는 bpmn-js의 내부 구조에 따라 달라질 수 있음
    if (event.command && event.context) {
      const context = event.context;

      // 속성 변경 명령
      if (event.command === 'element.updateProperties' && context.element) {
        changes.push({
          type: 'property',
          elementId: context.element.id,
          elementType: context.element.businessObject?.$type,
          properties: context.properties || {},
          timestamp: Date.now(),
        });
      }

      // 이동 명령
      if (event.command === 'elements.move' && context.shapes) {
        context.shapes.forEach((shape: any) => {
          changes.push({
            type: 'position',
            elementId: shape.id,
            elementType: shape.businessObject?.$type,
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            timestamp: Date.now(),
          });
        });
      }
    }

    return changes;
  }

  // ==================== 콜백 관리 ====================

  /**
   * 로컬 변경사항 콜백 설정
   */
  onLocalChange(callback: (change: ChangeEvent) => void): void {
    this.onLocalChangeCallback = callback;
  }

  /**
   * 원격 변경사항 콜백 설정
   */
  onRemoteChange(callback: (change: ChangeEvent) => void): void {
    this.onRemoteChangeCallback = callback;
  }

  // ==================== 정리 및 유지보수 ====================

  /**
   * 정리 타이머 시작
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredEvents();
    }, this.EVENT_SOURCE_TTL);
  }

  /**
   * 만료된 이벤트 정리
   */
  private cleanupExpiredEvents(): void {
    const now = Date.now();

    // 만료된 이벤트 소스 히스토리 정리
    for (const [elementId, sourceInfo] of this.eventSourceHistory.entries()) {
      if (now - sourceInfo.timestamp > this.EVENT_SOURCE_TTL) {
        this.eventSourceHistory.delete(elementId);
      }
    }

    // 만료된 변경사항 추적 정보 정리
    for (const [elementId, trackingInfo] of this.changeTracker.entries()) {
      if (now - trackingInfo.lastTimestamp > this.EVENT_SOURCE_TTL * 2) {
        this.changeTracker.delete(elementId);
      }
    }
  }

  /**
   * 서비스 정리
   */
  cleanup(): void {
    // 타이머 정리
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // 버퍼 정리
    this.changeBuffer.clear();
    this.remoteEventSources.clear();
    this.eventSourceHistory.clear();
    this.changeTracker.clear();

    // 콜백 정리
    this.onLocalChangeCallback = undefined;
    this.onRemoteChangeCallback = undefined;
  }

  /**
   * 서비스 상태 정보 반환
   */
  getServiceInfo(): {
    isProcessingRemoteEvent: boolean;
    remoteEventSourcesCount: number;
    changeTrackerSize: number;
    eventSourceHistorySize: number;
    changeBufferSize: number;
  } {
    return {
      isProcessingRemoteEvent: this.isProcessingRemoteEvent,
      remoteEventSourcesCount: this.remoteEventSources.size,
      changeTrackerSize: this.changeTracker.size,
      eventSourceHistorySize: this.eventSourceHistory.size,
      changeBufferSize: this.changeBuffer.size,
    };
  }
}

/**
 * CollaborationEventManager 모듈 정의
 */
export const CollaborationEventManagerModule = {
  __init__: ['collaborationEventManager'],
  collaborationEventManager: ['type', CollaborationEventManager],
};
