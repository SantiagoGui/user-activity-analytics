/** Thrown by route handlers/validators; caught centrally and turned into a JSON error response. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
