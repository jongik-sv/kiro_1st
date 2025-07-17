import { Express } from 'express';
import { healthRouter } from './health';
import { userRouter } from './users';
import { diagramRouter } from './diagrams';

export function setupRoutes(app: Express): void {
  // Health check endpoint
  app.use('/api/health', healthRouter);
  
  // API routes
  app.use('/api/users', userRouter);
  app.use('/api/diagrams', diagramRouter);
  
  // 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      error: 'API endpoint not found',
      path: req.path
    });
  });
  
  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      message: 'BPMN Collaboration Tool API',
      version: '1.0.0',
      status: 'running'
    });
  });
}