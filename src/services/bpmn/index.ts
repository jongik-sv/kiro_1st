// Silent CommandStack 및 Modeling 모듈 통합 export
export { SilentCommandStack, SilentCommandStackModule } from './SilentCommandStackModule';
export { SilentModeling, SilentModelingModule } from './SilentModeling';

// 통합 모듈 정의
export const SilentCollaborationModule = {
  __depends__: [
    require('diagram-js/lib/core').default,
    require('bpmn-js/lib/features/rules').default
  ],
  __init__: ['silentCommandStack', 'silentModeling'],
  silentCommandStack: ['type', require('./SilentCommandStackModule').SilentCommandStack],
  silentModeling: ['type', require('./SilentModeling').SilentModeling]
};