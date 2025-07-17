import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import {
  BPMNEditorProps,
  ElementChangeEvent,
  BPMNEditorRef,
  Canvas,
  EventBus,
} from '../../types/bpmn';
import {
  SilentCommandStackModule,
  SilentModelingModule,
  SilentCommandStack,
  SilentModeling,
} from '../../services/bpmn';

// Import bpmn-js CSS
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

// Default empty BPMN diagram
const DEFAULT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                   xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                   xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
                   xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd" 
                   id="sample-diagram" 
                   targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="StartEvent_1"/>
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds height="36.0" width="36.0" x="412.0" y="240.0"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

const BPMNEditor = forwardRef<BPMNEditorRef, BPMNEditorProps>((props, ref) => {
  const { diagramId, initialXML, onElementChange, onSelectionChange } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize BPMN modeler with Silent modules
    const modeler = new BpmnModeler({
      container: containerRef.current,
      keyboard: {
        bindTo: window,
      },
      additionalModules: [SilentCommandStackModule, SilentModelingModule],
    });

    modelerRef.current = modeler;

    // Load initial diagram
    const xmlToLoad = initialXML || DEFAULT_BPMN_XML;

    modeler
      .importXML(xmlToLoad)
      .then(() => {
        setIsLoading(false);
        setError(null);

        // Fit diagram to viewport
        const canvas = modeler.get('canvas') as Canvas;
        canvas.zoom('fit-viewport');

        console.log('BPMN diagram loaded successfully');
      })
      .catch((err: any) => {
        setIsLoading(false);
        setError(`Failed to load BPMN diagram: ${err.message}`);
        console.error('Error loading BPMN diagram:', err);
      });

    // Set up event listeners for element changes
    setupEventListeners(modeler);

    // Cleanup function
    return () => {
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, [diagramId, initialXML]);

  const setupEventListeners = (modeler: BpmnModeler) => {
    const eventBus = modeler.get('eventBus') as EventBus;

    // Listen for element changes
    eventBus.on('element.changed', (event: any) => {
      const changeEvent: ElementChangeEvent = {
        type: 'update',
        elementId: event.element.id,
        elementData: {
          id: event.element.id,
          type: event.element.type,
          businessObject: event.element.businessObject,
          x: event.element.x,
          y: event.element.y,
          width: event.element.width,
          height: event.element.height,
        },
        timestamp: Date.now(),
      };

      onElementChange(changeEvent);
    });

    // Listen for element creation
    eventBus.on(['shape.added', 'connection.added'], (event: any) => {
      const changeEvent: ElementChangeEvent = {
        type: 'create',
        elementId: event.element.id,
        elementData: {
          id: event.element.id,
          type: event.element.type,
          businessObject: event.element.businessObject,
          x: event.element.x,
          y: event.element.y,
          width: event.element.width,
          height: event.element.height,
        },
        timestamp: Date.now(),
      };

      onElementChange(changeEvent);
    });

    // Listen for element deletion
    eventBus.on(['shape.removed', 'connection.removed'], (event: any) => {
      const changeEvent: ElementChangeEvent = {
        type: 'delete',
        elementId: event.element.id,
        elementData: {
          id: event.element.id,
          type: event.element.type,
        },
        timestamp: Date.now(),
      };

      onElementChange(changeEvent);
    });

    // Listen for element moves
    eventBus.on('element.moved', (event: any) => {
      const changeEvent: ElementChangeEvent = {
        type: 'move',
        elementId: event.element.id,
        elementData: {
          id: event.element.id,
          x: event.element.x,
          y: event.element.y,
        },
        timestamp: Date.now(),
      };

      onElementChange(changeEvent);
    });

    // Listen for selection changes
    eventBus.on('selection.changed', (event: any) => {
      const selectedElements = event.newSelection;
      if (selectedElements.length > 0) {
        onSelectionChange(selectedElements[0].id);
      } else {
        onSelectionChange('');
      }
    });
  };

  // Public methods for external control
  const exportXML = async (): Promise<string> => {
    if (!modelerRef.current) {
      throw new Error('BPMN modeler not initialized');
    }

    try {
      const result = await modelerRef.current.saveXML({ format: true });
      return result.xml || '';
    } catch (error) {
      console.error('Error exporting XML:', error);
      throw error;
    }
  };

  const importXML = async (xml: string): Promise<void> => {
    if (!modelerRef.current) {
      throw new Error('BPMN modeler not initialized');
    }

    try {
      setIsLoading(true);
      await modelerRef.current.importXML(xml);

      // Fit diagram to viewport
      const canvas = modelerRef.current.get('canvas') as Canvas;
      canvas.zoom('fit-viewport');

      setIsLoading(false);
      setError(null);
    } catch (error) {
      setIsLoading(false);
      setError(`Failed to import XML: ${error}`);
      throw error;
    }
  };

  const zoomToFit = () => {
    if (modelerRef.current) {
      const canvas = modelerRef.current.get('canvas') as Canvas;
      canvas.zoom('fit-viewport');
    }
  };

  const zoomIn = () => {
    if (modelerRef.current) {
      const canvas = modelerRef.current.get('canvas') as Canvas;
      const currentZoom = canvas.zoom();
      canvas.zoom(currentZoom + 0.1);
    }
  };

  const zoomOut = () => {
    if (modelerRef.current) {
      const canvas = modelerRef.current.get('canvas') as Canvas;
      const currentZoom = canvas.zoom();
      canvas.zoom(currentZoom - 0.1);
    }
  };

  // Silent update methods for collaboration
  const applySilentUpdate = (changeEvent: ElementChangeEvent) => {
    if (!modelerRef.current) return;

    try {
      const silentModeling = (modelerRef.current as any).get(
        'silentModeling'
      ) as SilentModeling;

      switch (changeEvent.type) {
        case 'update':
          const element = (modelerRef.current as any)
            .get('elementRegistry')
            .get(changeEvent.elementId);
          if (element && changeEvent.elementData.businessObject) {
            silentModeling.updatePropertiesSilently(
              element,
              changeEvent.elementData.businessObject
            );
          }
          break;
        case 'move':
          const moveElement = (modelerRef.current as any)
            .get('elementRegistry')
            .get(changeEvent.elementId);
          if (
            moveElement &&
            changeEvent.elementData.x !== undefined &&
            changeEvent.elementData.y !== undefined
          ) {
            const delta = {
              x: changeEvent.elementData.x - moveElement.x,
              y: changeEvent.elementData.y - moveElement.y,
            };
            silentModeling.moveElementSilently(moveElement, delta);
          }
          break;
        case 'create':
          if (changeEvent.elementData) {
            silentModeling.createElementSilently(changeEvent.elementData, {
              x: changeEvent.elementData.x || 0,
              y: changeEvent.elementData.y || 0,
            });
          }
          break;
        case 'delete':
          const deleteElement = (modelerRef.current as any)
            .get('elementRegistry')
            .get(changeEvent.elementId);
          if (deleteElement) {
            silentModeling.removeElementSilently(deleteElement);
          }
          break;
      }
    } catch (error) {
      console.error('Error applying silent update:', error);
    }
  };

  const applySilentBatchUpdates = (changeEvents: ElementChangeEvent[]) => {
    if (!modelerRef.current) return;

    try {
      const silentModeling = (modelerRef.current as any).get(
        'silentModeling'
      ) as SilentModeling;
      const updates = changeEvents.map(event => {
        const element = (modelerRef.current as any)
          .get('elementRegistry')
          .get(event.elementId);
        return {
          type: event.type as 'update' | 'move' | 'create' | 'remove',
          element: element,
          data: event.elementData,
        };
      });

      silentModeling.executeBatchUpdatesSilently(updates);
    } catch (error) {
      console.error('Error applying silent batch updates:', error);
    }
  };

  const getSilentCommandStack = (): SilentCommandStack | null => {
    if (!modelerRef.current) return null;
    return (modelerRef.current as any).get(
      'silentCommandStack'
    ) as SilentCommandStack;
  };

  const getSilentModeling = (): SilentModeling | null => {
    if (!modelerRef.current) return null;
    return (modelerRef.current as any).get('silentModeling') as SilentModeling;
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    exportXML,
    importXML,
    zoomToFit,
    zoomIn,
    zoomOut,
    getModeler: () => modelerRef.current,
    applySilentUpdate,
    applySilentBatchUpdates,
    getSilentCommandStack,
    getSilentModeling,
  }));

  return (
    <div
      className="bpmn-editor"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {/* Toolbar */}
      <div
        className="bpmn-toolbar"
        style={{
          padding: '8px',
          borderBottom: '1px solid #ddd',
          backgroundColor: '#f5f5f5',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <button onClick={zoomIn} disabled={isLoading}>
          Zoom In
        </button>
        <button onClick={zoomOut} disabled={isLoading}>
          Zoom Out
        </button>
        <button onClick={zoomToFit} disabled={isLoading}>
          Fit to Screen
        </button>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#666' }}>
          Diagram: {diagramId}
        </span>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '20px',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          Loading BPMN diagram...
        </div>
      )}

      {/* Error display */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            backgroundColor: '#ffebee',
            color: '#c62828',
            padding: '20px',
            borderRadius: '4px',
            border: '1px solid #ef5350',
            maxWidth: '400px',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* BPMN Canvas */}
      <div
        ref={containerRef}
        className="bpmn-canvas"
        style={{
          width: '100%',
          height: 'calc(100% - 50px)', // Account for toolbar height
          backgroundColor: '#fafafa',
        }}
      />
    </div>
  );
});

BPMNEditor.displayName = 'BPMNEditor';

export default BPMNEditor;
