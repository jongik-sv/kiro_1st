// Silent CommandStack 및 Modeling 모듈 통합 export
export {
  SilentCommandStack,
  SilentCommandStackModule,
} from './SilentCommandStackModule';
export { SilentModeling, SilentModelingModule } from './SilentModeling';
export {
  SilentUpdateService,
  SilentUpdateServiceModule,
  SilentUpdateOperation,
} from './SilentUpdateService';
export {
  CollaborationEventManager,
  CollaborationEventManagerModule,
  ChangeEvent,
} from './CollaborationEventManager';

// 통합 모듈 정의
export const SilentCollaborationModule = {
  __depends__: [
    require('diagram-js/lib/core').default,
    require('bpmn-js/lib/features/rules').default,
  ],
  __init__: [
    'silentCommandStack',
    'silentModeling',
    'silentUpdateService',
    'collaborationEventManager',
  ],
  silentCommandStack: [
    'type',
    require('./SilentCommandStackModule').SilentCommandStack,
  ],
  silentModeling: ['type', require('./SilentModeling').SilentModeling],
  silentUpdateService: [
    'type',
    require('./SilentUpdateService').SilentUpdateService,
  ],
  collaborationEventManager: [
    'type',
    require('./CollaborationEventManager').CollaborationEventManager,
  ],
};
