/**
 * Domain-level errors with HTTP status codes.
 * The error middleware maps these to JSON responses.
 */

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request', details?: unknown) {
    super(400, 'bad_request', message, details)
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(404, 'not_found', message)
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, 'conflict', message, details)
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = 'Too many requests', retryAfter = 1) {
    super(429, 'rate_limited', message, { retryAfter })
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Unprocessable entity', details?: unknown) {
    super(422, 'unprocessable_entity', message, details)
  }
}
