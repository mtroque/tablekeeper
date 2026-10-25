import {
  ErrorEnvelopeSchema,
  GamesResponseSchema,
  HealthResponseSchema,
  MeResponseSchema,
  type ErrorCode,
  type GamesResponse,
  type HealthResponse,
  type MeResponse,
} from '@tablekeeper/core';
import type { z } from 'zod';

/** A failed API call. `code` is `NETWORK` when the server couldn't be reached at all. */
export class ApiError extends Error {
  readonly code: ErrorCode | 'NETWORK';
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode | 'NETWORK', status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  /** The current Supabase access token, or null for a guest. */
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
  /** Wait before the single cold-start retry. */
  retryDelayMs?: number;
};

type RequestOptions<T> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
};

// Render's free tier answers with a gateway error (or drops the connection) while it wakes.
const COLD_START_STATUSES = new Set([502, 503, 504]);

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const retryDelayMs = options.retryDelayMs ?? 1500;

  async function send(path: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      try {
        const res = await doFetch(`${options.baseUrl}${path}`, init);
        if (attempt === 0 && COLD_START_STATUSES.has(res.status)) {
          lastError = new ApiError('NETWORK', res.status, "Couldn't reach the server. Try again.");
          continue;
        }
        return res;
      } catch (error) {
        if (init.signal?.aborted) throw error;
        lastError = error;
      }
    }
    if (lastError instanceof ApiError) throw lastError;
    throw new ApiError('NETWORK', 0, "Couldn't reach the server. Try again.");
  }

  async function request<T>(
    path: string,
    { method = 'GET', body, schema, signal }: RequestOptions<T>,
  ): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    const token = await options.getToken();
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';

    const res = await send(path, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
    const json: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const envelope = ErrorEnvelopeSchema.safeParse(json);
      if (envelope.success) {
        const { code, message, details } = envelope.data.error;
        throw new ApiError(code, res.status, message, details);
      }
      throw new ApiError(
        'INTERNAL',
        res.status,
        'The server sent an unexpected answer. Try again.',
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(
        'INTERNAL',
        res.status,
        'The server sent an unexpected answer. Try again.',
      );
    }
    return parsed.data;
  }

  return {
    request,
    health: (signal?: AbortSignal): Promise<HealthResponse> =>
      request('/health', { schema: HealthResponseSchema, ...(signal ? { signal } : {}) }),
    games: (): Promise<GamesResponse> => request('/v1/games', { schema: GamesResponseSchema }),
    me: (): Promise<MeResponse> => request('/v1/me', { schema: MeResponseSchema }),
  };
}
