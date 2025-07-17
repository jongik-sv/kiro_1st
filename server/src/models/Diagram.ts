import mongoose, { Document, Schema } from 'mongoose';

export interface IDiagram extends Document {
  _id: string;
  title: string;
  description?: string;
  bpmnXml: string;
  owner: string;
  collaborators: string[];
  isPublic: boolean;
  version: number;
  lastModified: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DiagramSchema = new Schema<IDiagram>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  bpmnXml: {
    type: String,
    required: true
  },
  owner: {
    type: String,
    required: true,
    ref: 'User'
  },
  collaborators: [{
    type: String,
    ref: 'User'
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  version: {
    type: Number,
    default: 1
  },
  lastModified: {
    type: Date,
    default: Date.now
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
DiagramSchema.index({ owner: 1 });
DiagramSchema.index({ collaborators: 1 });
DiagramSchema.index({ isPublic: 1 });
DiagramSchema.index({ title: 'text', description: 'text' });

export const Diagram = mongoose.model<IDiagram>('Diagram', DiagramSchema);