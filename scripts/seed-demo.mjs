#!/usr/bin/env node
// Local demo data through the real API: a gents salon with 3 barbers, a week of bills,
// udhaar customers, expenses and a pending subscription payment.
//   npm run dev   (one terminal)
//   npm run seed:demo
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

class Device {
  cookies = new Map();
  constructor(app) {
    this.app = app;
  }
  async req(method, path, body) {
    const headers = { origin: BASE, 'x-app': this.app };
    if (body) headers['content-type'] = 'application/json';
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      this.cookies.set(k.trim(), v);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
    return data;
  }
}

const OWNER = { phone: '9847000001', pin: '482913' };
const BARBERS = [
  { name: 'Suresh', phone: '9847000002', pin: '4826', commissionPct: 40 },
  { name: 'Vinod', phone: '9847000003', pin: '7391', commissionPct: 35 },
];
const CUSTOMERS = [
  ['Arjun', '9847100001'], ['Rahul', '9847100002'], ['Fahad', '9847100003'], ['Vikram', '9847100004'], ['Joseph', '9847100005'],
  ['Imran', '9847100006'], ['Kiran', '9847100007'], ['Manu', '9847100008'], ['Sanjay', '9847100009'], ['Anil', '9847100010'],
];

async function main() {
  await fetch(`${BASE}/api/health`).catch(() => {
    console.error(`No dev server at ${BASE}. Run "npm run dev" first.`);
    process.exit(1);
  });
  const seedStart = Date.now() - 1000;
  const owner = new Device('owner');
  try {
    await owner.req('POST', '/api/auth/signup', { name: 'Ramesh', phone: OWNER.phone, pin: OWNER.pin, shopName: 'Style Point Salon', city: 'Kochi', shopType: 'gents' });
  } catch (err) {
    if (String(err).includes('409')) {
      console.log('Demo shop already exists. Delete .wrangler/state to start again.');
      return;
    }
    throw err;
  }
  await owner.req('PATCH', '/api/shop/settings', { upiVpa: 'stylepoint@okaxis', upiName: 'Style Point Salon', address: 'MG Road', state: 'Kerala' });
  await owner.req('POST', '/api/shop/onboarded');
  const team = [];
  for (const b of BARBERS) team.push({ ...b, id: (await owner.req('POST', '/api/shop/staff', b)).id });
  await owner.req('POST', '/api/shop/products', { name: 'Hair gel', price: 15000, cost: 9000, stock: 8, lowStock: 3 });
  await owner.req('POST', '/api/shop/products', { name: 'Beard oil', price: 25000, cost: 14000, stock: 2, lowStock: 3 });
  const catalog = await owner.req('GET', '/api/shop/catalog');
  const svc = (n) => {
    const s = catalog.services.find((x) => x.name === n);
    return { kind: 'service', refId: s.id, name: s.name, qty: 1, unitPrice: s.price };
  };
  const combos = [['Haircut'], ['Haircut', 'Shave'], ['Beard trim'], ['Haircut + Beard'], ['Head massage', 'Haircut'], ['Kids haircut'], ['Facial'], ['Hair colour']];
  const staffIds = [catalog.staff.find((s) => s.role === 'owner').id, ...team.map((t) => t.id)];
  let n = 0;
  for (let day = 6; day >= 0; day--) {
    const count = day === 0 ? 9 : 10 + ((day * 3) % 7);
    for (let i = 0; i < count; i++) {
      n++;
      const items = combos[(n * 7) % combos.length].map(svc);
      const discount = n % 9 === 0 ? 1000 : 0;
      const total = items.reduce((s, x) => s + x.unitPrice, 0) - discount;
      const cust = n % 3 === 0 ? CUSTOMERS[n % CUSTOMERS.length] : null;
      const mode = n % 4;
      const payments = mode === 0 ? { cash: total } : mode === 3 && cust ? { cash: Math.floor(total / 2 / 100) * 100 } : { upi: total };
      const createdAt = Date.now() - day * 86400000 - (count - i) * 25 * 60000;
      await owner.req('POST', '/api/shop/bills', {
        clientRef: `seed-${String(n).padStart(4, "0")}`,
        staffId: staffIds[n % staffIds.length],
        customerPhone: cust?.[1] ?? null,
        customerName: cust?.[0] ?? null,
        items,
        discount,
        payments,
        createdAt: day <= 2 ? createdAt : undefined,
      });
    }
  }
  await owner.req('POST', '/api/shop/expenses', { category: 'Tea & snacks', amount: 12000, mode: 'cash' });
  await owner.req('POST', '/api/shop/expenses', { category: 'Electricity', amount: 185000, mode: 'upi' });
  await owner.req('POST', `/api/shop/staff/${team[0].id}/txns`, { kind: 'advance', amount: 100000, mode: 'cash' });
  await owner.req('POST', '/api/shop/queue', { name: 'Walk-in', staffId: null });
  await owner.req('POST', '/api/shop/queue', { name: 'Ajay', phone: '9847100020' });
  await owner.req('POST', '/api/shop/subscription', { planId: 'starter', period: 'year', utr: '412345678901' });

  // Bills for 3–6 days ago were stamped "now" by the API (it only back-dates offline bills up to 3 days); spread them back.
  const sql = `UPDATE bills SET day = date(created_at / 1000 - ((CAST(substr(client_ref, 6) AS INTEGER) % 4) + 3) * 86400, 'unixepoch', '+330 minutes'),
    created_at = created_at - ((CAST(substr(client_ref, 6) AS INTEGER) % 4) + 3) * 86400000
    WHERE client_ref LIKE 'seed-%' AND created_at >= ${seedStart};`;
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'snipmemory', '--local', '--command', sql], { stdio: 'ignore' });

  execFileSync('node', ['scripts/create-admin.mjs', '9847000099', 'SnipMemory Ops', 'local-admin-password'], { stdio: 'ignore' });
  console.log(`Seeded "Style Point Salon" with ${n} bills.
  Owner app  /owner  mobile ${OWNER.phone}  PIN ${OWNER.pin}
  Staff app  /staff  ${BARBERS.map((b) => `${b.name}: ${b.phone} PIN ${b.pin}`).join(' · ')}
  Admin      /admin  phone 9847000099  password local-admin-password`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
