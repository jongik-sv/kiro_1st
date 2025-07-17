// Collaboration related type definitions
export interface User {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

export interface CursorPosition {
  x: number;
  y: number;
  elementId?: string;
}

export interface CollaborationState {
  connectedUsers: User[];
  userCursors: Map<string, CursorPosition>;
  selectedElements: Map<string, string>; // userId -> elementId
}

export interface UserSession {
  userId: string;
  socketId: string;
  userName: string;
  joinedAt: Date;
  lastSeen: Date;
  currentSelection?: string;
  cursorPosition?: CursorPosition;
}

export interface CollaborationSession {
  diagramId: string;
  connectedUsers: Map<string, UserSession>;
  lastActivity: Date;
  changeBuffer: any[];
}

export interface SocketEvents {
  'join-diagram': (diagramId: string) => void;
  'leave-diagram': (diagramId: string) => void;
  'element-change': (change: any) => void;
  'cursor-move': (position: CursorPosition) => void;
  'element-select': (elementId: string) => void;
}
