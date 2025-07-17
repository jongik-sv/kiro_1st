import React, { useRef, useState } from 'react';
import { BPMNEditor } from './components';
import { ElementChangeEvent, BPMNEditorRef } from './types/bpmn';
import './App.css';

function App() {
  const editorRef = useRef<BPMNEditorRef>(null);
  const [selectedElement, setSelectedElement] = useState<string>('');
  const [changeLog, setChangeLog] = useState<ElementChangeEvent[]>([]);

  const handleElementChange = (event: ElementChangeEvent) => {
    console.log('Element changed:', event);
    setChangeLog(prev => [...prev.slice(-9), event]); // Keep last 10 changes
  };

  const handleSelectionChange = (elementId: string) => {
    console.log('Selection changed:', elementId);
    setSelectedElement(elementId);
  };

  const handleExportXML = async () => {
    if (editorRef.current) {
      try {
        const xml = await editorRef.current.exportXML();
        console.log('Exported XML:', xml);

        // Create download link
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'diagram.bpmn';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to export XML:', error);
      }
    }
  };

  const handleImportXML = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bpmn,.xml';
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && editorRef.current) {
        try {
          const xml = await file.text();
          await editorRef.current.importXML(xml);
          console.log('Imported XML successfully');
        } catch (error) {
          console.error('Failed to import XML:', error);
        }
      }
    };
    input.click();
  };

  return (
    <div
      className="App"
      style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <header
        style={{
          backgroundColor: '#282c34',
          color: 'white',
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
          BPMN Collaboration Tool
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleExportXML}
            style={{
              padding: '8px 16px',
              backgroundColor: '#61dafb',
              color: '#282c34',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Export BPMN
          </button>
          <button
            onClick={handleImportXML}
            style={{
              padding: '8px 16px',
              backgroundColor: '#61dafb',
              color: '#282c34',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Import BPMN
          </button>
        </div>
      </header>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex' }}>
        {/* BPMN Editor */}
        <div style={{ flex: 1 }}>
          <BPMNEditor
            ref={editorRef}
            diagramId="test-diagram-1"
            onElementChange={handleElementChange}
            onSelectionChange={handleSelectionChange}
          />
        </div>

        {/* Side panel for debugging */}
        <div
          style={{
            width: '300px',
            backgroundColor: '#f5f5f5',
            borderLeft: '1px solid #ddd',
            padding: '10px',
            overflow: 'auto',
          }}
        >
          <h3 style={{ margin: '0 0 10px 0' }}>Debug Panel</h3>

          <div style={{ marginBottom: '15px' }}>
            <strong>Selected Element:</strong>
            <div
              style={{
                padding: '5px',
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '3px',
                fontSize: '12px',
                marginTop: '5px',
              }}
            >
              {selectedElement || 'None'}
            </div>
          </div>

          <div>
            <strong>Recent Changes:</strong>
            <div
              style={{
                maxHeight: '400px',
                overflow: 'auto',
                marginTop: '5px',
              }}
            >
              {changeLog.length === 0 ? (
                <div
                  style={{
                    padding: '10px',
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    fontSize: '12px',
                    color: '#666',
                  }}
                >
                  No changes yet. Try adding, moving, or modifying elements in
                  the diagram.
                </div>
              ) : (
                changeLog
                  .slice()
                  .reverse()
                  .map((change, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '8px',
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '3px',
                        marginBottom: '5px',
                        fontSize: '11px',
                      }}
                    >
                      <div>
                        <strong>Type:</strong> {change.type}
                      </div>
                      <div>
                        <strong>Element:</strong> {change.elementId}
                      </div>
                      <div>
                        <strong>Time:</strong>{' '}
                        {new Date(change.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
