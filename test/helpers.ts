import { SELF } from 'cloudflare:test';

const ORIGIN = 'https://snipmemory.test';

/** Minimal browser: keeps cookies between requests and parses JSON. */
export class Browser {
  cookies = new Map<string, string>();

  async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const init: RequestInit = { method, headers: { origin: ORIGIN, ...headers } };
    if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
      init.body = body;
    } else if (body !== undefined) {
      init.body = JSON.stringify(body);
      (init.headers as Record<string, string>)['content-type'] = 'application/json';
    }
    if (this.cookies.size) {
      (init.headers as Record<string, string>).cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    const res = await SELF.fetch(`${ORIGIN}${path}`, init);
    for (const header of res.headers.getSetCookie()) {
      const [pair, ...attrs] = header.split(';');
      const [name, value] = pair.split('=');
      const expired = attrs.some((a) => /max-age=0/i.test(a.trim()) || /expires=thu, 01 jan 1970/i.test(a.trim()));
      if (!value || expired) this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value.trim());
    }
    const type = res.headers.get('content-type') ?? '';
    const data = type.includes('application/json') ? await res.json<any>() : type.startsWith('text/') ? await res.text() : await res.arrayBuffer();
    return { status: res.status, data, headers: res.headers };
  }

  get = (path: string) => this.request('GET', path);
  post = (path: string, body: unknown = {}) => this.request('POST', path, body);
  patch = (path: string, body: unknown) => this.request('PATCH', path, body);
  put = (path: string, body: unknown, headers?: Record<string, string>) => this.request('PUT', path, body, headers);
  del = (path: string) => this.request('DELETE', path);
}

let counter = 0;

export async function signup(overrides: Record<string, unknown> = {}) {
  const browser = new Browser();
  counter++;
  const res = await browser.post('/api/auth/signup', {
    name: `Owner ${counter}`,
    email: `owner${counter}-${Date.now()}@example.com`,
    password: 'correct horse battery',
    salonName: `Fade Lab ${counter}`,
    country: 'IN',
    timezone: 'Asia/Kolkata',
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`signup failed: ${JSON.stringify(res.data)}`);
  const salonId: string = res.data.memberships[0].salon.id;
  return { browser, salonId, me: res.data };
}

export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);
