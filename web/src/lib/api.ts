export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

/** Which installed app is talking — the server keeps a separate login per app. */
let currentApp: 'owner' | 'staff' | 'admin' = 'owner';
export function setApp(app: typeof currentApp) {
  currentApp = app;
}
export function getApp() {
  return currentApp;
}

type Body = Record<string, unknown> | unknown[] | Blob | undefined;

async function request<T>(method: string, path: string, body?: Body, headers: Record<string, string> = {}): Promise<T> {
  const h: Record<string, string> = { ...headers };
  if (currentApp !== 'admin') h['x-app'] = currentApp;
  const init: RequestInit = { method, headers: h, credentials: 'same-origin' };
  if (body instanceof Blob) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    h['content-type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(0, 'offline', 'No internet. Check your connection.');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const err = (data as { error?: { code: string; message: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'error', err?.message ?? 'Something went wrong. Try again.', data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: Body = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: Body) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: Body) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, blob: Blob, headers: Record<string, string> = {}) => request<T>('POST', path, blob, { 'content-type': blob.type, ...headers }),
};

export function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export const isOffline = (err: unknown) => err instanceof ApiError && err.status === 0;
