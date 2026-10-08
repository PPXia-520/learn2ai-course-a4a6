export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Array<{ field?: string; message: string }>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
