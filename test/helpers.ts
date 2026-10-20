import { SELF } from 'cloudflare:test';

const ORIGIN = 'https://snipmemory.test';

/** A phone with one of the apps installed: keeps cookies and sends the app header. */
export class Device {
  cookies = new Map<string, string>();
  ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  constructor(public app: 'owner' | 'staff' | 'admin' = 'owner') {}

  async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { origin: ORIGIN, 'cf-connecting-ip': this.ip, ...headers };
    if (this.app !== 'admin') h['x-app'] = this.app;
    const init: RequestInit = { method, headers: h };
    if (body instanceof Uint8Array) init.body = body;
    else if (body !== undefined) {
      init.body = JSON.stringify(body);
      h['content-type'] = 'application/json';
    }
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await SELF.fetch(`${ORIGIN}${path}`, init);
    for (const header of res.headers.getSetCookie()) {
      const [pair, ...attrs] = header.split(';');
      const [name, value] = pair.split('=');
      if (!value || attrs.some((a) => /max-age=0/i.test(a))) this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value.trim());
    }
    const type = res.headers.get('content-type') ?? '';
    const data = type.includes('json') ? await res.json<any>() : await res.text();
    return { status: res.status, data };
  }
  get = (p: string) => this.request('GET', p);
  post = (p: string, b: unknown = {}) => this.request('POST', p, b);
  patch = (p: string, b: unknown) => this.request('PATCH', p, b);
  del = (p: string) => this.request('DELETE', p);
}

let n = 0;
export function phone(): string {
  n++;
  return `9${String(Date.now() % 1e6).padStart(6, '0')}${String(n).padStart(3, '0')}`;
}

export const OWNER_PIN = '482913';

export async function newShop(shopType = 'gents') {
  const owner = new Device('owner');
  const ownerPhone = phone();
  const res = await owner.post('/api/auth/signup', { name: 'Ramesh', phone: ownerPhone, pin: OWNER_PIN, shopName: 'Style Point', city: 'Kochi', shopType });
  if (res.status !== 201) throw new Error(JSON.stringify(res.data));
  const catalog = (await owner.get('/api/shop/catalog')).data;
  const me = (await owner.get('/api/auth/me')).data;
  return { owner, ownerPhone, catalog, me };
}

export async function addBarber(owner: Device, opts: { name?: string; commissionPct?: number; pin?: string } = {}) {
  const p = phone();
  const pin = opts.pin ?? '4826';
  const res = await owner.post('/api/shop/staff', { name: opts.name ?? 'Suresh', phone: p, pin, commissionPct: opts.commissionPct ?? 40 });
  if (res.status !== 201) throw new Error(JSON.stringify(res.data));
  const device = new Device('staff');
  const login = await device.post('/api/auth/login', { phone: p, pin, app: 'staff' });
  if (login.status !== 200) throw new Error(JSON.stringify(login.data));
  return { id: res.data.id as string, phone: p, device };
}

let ref = 0;
export const clientRef = () => `ref-${Date.now()}-${++ref}`;

export function svc(catalog: any, name: string) {
  const s = catalog.services.find((x: any) => x.name === name);
  if (!s) throw new Error(`no service ${name}`);
  return { kind: 'service', refId: s.id, name: s.name, qty: 1, unitPrice: s.price };
}
