import type { Context } from 'hono';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 402 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 502,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'bad_request') => new ApiError(400, code, message);
export const unauthorized = (message = 'Please sign in.') => new ApiError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have access to this.') => new ApiError(403, 'forbidden', message);
export const notFound = (what = 'Resource') => new ApiError(404, 'not_found', `${what} not found.`);
export const conflict = (message: string, code = 'conflict') => new ApiError(409, code, message);
export const paymentRequired = (message: string, code = 'plan_limit') => new ApiError(402, code, message);

/** Parses and validates a JSON request body. */
export async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw badRequest('Request body must be JSON.');
  }
  return validate(schema, raw);
}

export function validate<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join('.');
    throw new ApiError(422, 'validation_error', field ? `${field}: ${issue.message}` : (issue?.message ?? 'Invalid input.'));
  }
  return result.data;
}

export function query<T extends z.ZodType>(c: Context, schema: T): z.infer<T> {
  return validate(schema, c.req.query());
}

export function clientIp(c: Context): string {
  return c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
