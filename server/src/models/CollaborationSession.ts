import mongoose, { Document, Schema } from 'mongoose';

export interface ICollaborationSession extends Document {
  _id: string;
  diagramId: string;
  participants: Array<{
    userId: string;
    socketId: string;
    joinedAt: Date;
    cursor?: {
      x: number;
      y: number;
    };
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CollaborationSessionSchema = new Schema<ICollaborationSession>({
  diagramId: {
    type: String,
    required: true,
    ref: 'Diagram'
  },
  participants: [{
    userId: {
      type: String,
      required: true,
      ref: 'User'
    },
    socketId: {
      type: String,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    cursor: {
      x: { type: Number },
      y: { type: Number }
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// 인덱스 설정
CollaborationSessionSchema.index({ diagramId: 1 });
CollaborationSessionSchema.index({ 'participants.userId': 1 });
CollaborationSessionSchema.index({ isActive: 1 });

export const CollaborationSession = mongoose.model<ICollaborationSession>('CollaborationSession', CollaborationSessionSchema);