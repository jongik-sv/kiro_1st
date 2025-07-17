// BPMN related type definitions
export interface BPMNElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  businessObject: {
    $type: string;
    id: string;
    name?: string;
    $parent: any;
  };
}

// bpmn-js Canvas interface
export interface Canvas {
  zoom(): number;
  zoom(factor: number | 'fit-viewport'): number;
  getRootElement(): any;
  getContainer(): HTMLElement;
  _addElement(element: any, parent?: any): void;
  _removeElement(element: any): void;
  _suspendRendering: boolean;
  _redraw(): void;
}

// bpmn-js EventBus interface
export interface EventBus {
  on(event: string | string[], callback: (event: any) => void): void;
  off(event: string | string[], callback?: (event: any) => void): void;
  fire(event: string, data?: any): any;
}

export interface ElementChangeEvent {
  type: 'create' | 'update' | 'delete' | 'move';
  elementId: string;
  elementData: any;
  timestamp: number;
}

export interface BPMNEditorProps {
  diagramId: string;
  initialXML?: string;
  onElementChange: (event: ElementChangeEvent) => void;
  onSelectionChange: (elementId: string) => void;
}

export interface BPMNEditorRef {
  exportXML: () => Promise<string>;
  importXML: (xml: string) => Promise<void>;
  zoomToFit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  getModeler: () => any;
  applySilentUpdate: (changeEvent: ElementChangeEvent) => void;
  applySilentBatchUpdates: (changeEvents: ElementChangeEvent[]) => void;
  getSilentCommandStack: () => SilentCommandStack | null;
  getSilentModeling: () => SilentModeling | null;
}

// Silent CommandStack 타입 정의
export interface SilentCommandStack {
  setSilentMode(silent: boolean): void;
  executeSilently(command: string, context?: any): any;
  executeBatchSilently(commands: Array<{command: string, context?: any}>): any[];
}

// Silent Modeling 타입 정의
export interface SilentModeling {
  updatePropertiesSilently(element: any, properties: any): void;
  moveElementSilently(element: any, delta: {x: number, y: number}): void;
  createElementSilently(elementData: any, position: {x: number, y: number}, parent?: any): any;
  removeElementSilently(element: any): void;
  createConnectionSilently(connectionData: any, source: any, target: any): any;
  executeBatchUpdatesSilently(updates: Array<{
    type: 'update' | 'move' | 'create' | 'remove',
    element?: any,
    data?: any
  }>): void;
}

export interface DiagramData {
  id: string;
  name: string;
  description?: string;
  bpmnXML: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  collaborators: string[];
  isPublic: boolean;
}
