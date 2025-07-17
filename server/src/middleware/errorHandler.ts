import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // MongoDB 중복 키 에러 처리
  if (error.name === 'MongoServerError' && (error as any).code === 11000) {
    statusCode = 409;
    message = 'Duplicate field value entered';
  }

  // MongoDB 유효성 검사 에러 처리
  if (error.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values((error as any).errors).map((val: any) => val.message);
    message = `Invalid input data: ${errors.join(', ')}`;
  }

  // MongoDB CastError 처리 (잘못된 ObjectId)
  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // JWT 에러 처리
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // 에러 로깅
  if (statusCode >= 500) {
    logger.error('Server Error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  } else {
    logger.warn('Client Error:', {
      message: error.message,
      url: req.url,
      method: req.method,
      ip: req.ip,
      statusCode
    });
  }

  // 개발 환경에서는 스택 트레이스 포함
  const response: any = {
    error: message,
    statusCode
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
}

// 비동기 함수 에러 처리를 위한 래퍼
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 에러 핸들러
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error: AppError = new Error(`Not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}