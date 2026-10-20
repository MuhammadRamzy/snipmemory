#!/usr/bin/env node
// Seeds a local dev environment through the real API (so every invariant holds),
// then spreads visit dates over the past months with a local D1 update.
//
//   npm run dev            # in one terminal
//   npm run seed:demo      # in another
//
// Creates:  owner  demo@snipmemory.app / demo-password   (salon "Fade Lab")
//           admin  admin@snipmemory.app / admin-password (platform admin, own salon)
//           stylists Ravi (PIN 1111) and Maya (PIN 2222)
import { execFileSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

class Session {
  cookies = new Map();
  async req(method, path, body, headers = {}) {
    const init = { method, headers: { origin: BASE, ...headers } };
    if (body instanceof Uint8Array) init.body = body;
    else if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers['content-type'] = 'application/json';
    }
    if (this.cookies.size) init.headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(BASE + path, init);
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      this.cookies.set(k.trim(), v);
    }
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    if (!res.ok && res.status !== 409) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
    return { status: res.status, data };
  }
}

// --- tiny PNG painter: a stylised head so photo grids look real -----------------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function headPng(angle, hue) {
  const W = 300, H = 400;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  const hair = [Math.round(40 + hue * 0.3), Math.round(25 + hue * 0.15), 15];
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const i = y * (W * 3 + 1) + 1 + x * 3;
      let col = [228 - y / 8, 226 - y / 8, 235 - y / 10];
      const side = angle === 'left' ? -1 : angle === 'right' ? 1 : 0;
      const hx = 150 + side * 10, hy = 170;
      const inHead = ((x - hx) / 78) ** 2 + ((y - hy) / 100) ** 2 < 1;
      const inBody = y > 290 && Math.abs(x - 150) < 120 - (y - 290) * -0.3;
      if (inBody) col = [52, 56, 70];
      if (inHead) col = [222, 182, 150];
      const hairTop = angle === 'back' ? y < 250 : y < 135 - Math.abs(x - hx) * 0.15 + (side * (x - hx) > 0 ? 25 : 0);
      if (inHead && hairTop) col = hair;
      if (angle === 'front' && inHead && !hairTop && y > 165 && y < 178 && (Math.abs(x - 122) < 9 || Math.abs(x - 178) < 9)) col = [60, 40, 30];
      raw[i] = col[0]; raw[i + 1] = col[1]; raw[i + 2] = col[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

const CLIENTS = [
  ['Arjun Nair', '9847012345', 'Skin fade', ['Fade', 'Textured'], { sides: '#0 to #2 mid skin fade', top: 'Scissor 4cm, point cut', back: 'Tapered neckline' }],
  ['Rahul Menon', '9847012346', 'Taper fade', ['Taper', 'Crop'], { sides: '#1 low taper', top: 'Textured crop, #4 on top', fringe: 'Blunt, 2cm' }],
  ['Fahad Ali', '9847012347', 'Cut & beard', ['Fade', 'Beard shape', 'Line-up'], { sides: '#0.5 high fade', beard: '#3 cheeks, #5 chin, sharp line', top: 'Slick back, 6cm' }],
  ['Neha Sharma', '9847012348', 'Layers', ['Layered', 'Fringe'], { top: 'Long layers, remove 2 inches', fringe: 'Curtain bangs to cheekbone' }],
  ['Vikram Rao', '9847012349', 'Buzz cut', ['Fade'], { sides: '#1 all over, #0 neckline', back: 'Squared' }],
  ['Joseph Thomas', '9847012350', 'Scissor cut', ['Side part', 'Classic'], { sides: 'Scissor over comb 2cm', top: '5cm, side part left' }],
  ['Aisha Khan', '9847012351', 'Bob', ['Blunt'], { top: 'Chin-length blunt bob, slight A-line' }],
  ['Sanjay Pillai', '9847012352', 'Kids cut', ['Crop'], { sides: '#3', top: 'Scissor 3cm' }],
  ['Imran Shaikh', '9847012353', 'Skin fade', ['Fade', 'Design'], { sides: '#0 skin, 1 line design right side', top: '#6 textured' }],
  ['Kiran Das', '9847012354', 'Cut & beard', ['Taper', 'Beard shape'], { sides: '#2 taper', beard: '#4 even, natural line' }],
  ['Deepa Iyer', '9847012355', 'Colour', ['Layered'], { colour: 'Wella 6/0 + 20vol roots, 30 min' }],
  ['Manu George', '9847012356', 'Taper fade', ['Taper', 'Quiff'], { sides: '#1 to #3', top: 'Quiff 7cm, blow-dried' }],
];

async function main() {
  await fetch(`${BASE}/api/health`).catch(() => {
    console.error(`No dev server at ${BASE}. Run "npm run dev" first.`);
    process.exit(1);
  });

  const admin = new Session();
  await admin.req('POST', '/api/auth/signup', { name: 'Platform Admin', email: 'admin@snipmemory.app', password: 'admin-password', salonName: 'SnipMemory HQ', country: 'IN', timezone: 'Asia/Kolkata' });

  const owner = new Session();
  const signup = await owner.req('POST', '/api/auth/signup', {
    name: 'Ramzy', email: 'demo@snipmemory.app', password: 'demo-password', salonName: 'Fade Lab', city: 'Kochi', phone: '9847000000', country: 'IN', timezone: 'Asia/Kolkata',
  });
  if (signup.status === 409) {
    console.log('Demo data already exists (demo@snipmemory.app). Delete .wrangler/state to start over.');
    return;
  }
  const salonId = signup.data.memberships[0].salon.id;
  const base = `/api/salons/${salonId}`;
  await owner.req('PATCH', base, { bookingUrl: 'https://wa.me/919847000000', sendWindowStart: 9, sendWindowEnd: 20, defaultCadenceDays: 21 });
  await owner.req('POST', `${base}/onboarded`);
  const ravi = (await owner.req('POST', `${base}/team`, { displayName: 'Ravi', role: 'stylist', pin: '1111' })).data.member;
  const maya = (await owner.req('POST', `${base}/team`, { displayName: 'Maya', role: 'stylist', pin: '2222' })).data.member;
  const stylists = [ravi.id, maya.id, signup.data.memberships[0].memberId];

  let n = 0;
  for (const [i, [name, phone, service, tags, technique]] of CLIENTS.entries()) {
    const { data } = await owner.req('POST', `${base}/clients`, { name, phone, photoConsent: true, marketingConsent: i % 4 !== 3 });
    const visits = 1 + (i % 4);
    for (let v = 0; v < visits; v++) {
      const visit = (await owner.req('POST', `${base}/clients/${data.client.id}/visits`, {
        service, styleTags: tags, technique, price: 30000 + (i % 3) * 10000, memberId: stylists[(i + v) % 3],
        notes: v === 0 ? 'Prefers it tight around the ears. Check the crown cowlick.' : null, products: 'Matte clay',
      })).data.visit;
      if (v === visits - 1 || i < 4) {
        for (const angle of ['front', 'left', 'right', 'back']) {
          await owner.req('PUT', `${base}/visits/${visit.id}/photos/${angle}`, headPng(angle, i * 20), { 'content-type': 'image/png' });
        }
      }
      n++;
    }
  }

  // Spread visits back in time: client i's visits every ~(18+i) days, most recent 5–40 days ago.
  const sql = `
    UPDATE visits SET created_at = created_at - (
      ((SELECT COUNT(*) FROM visits v2 WHERE v2.client_id = visits.client_id AND v2.created_at > visits.created_at) * (18 + (unicode(substr(visits.client_id, -1)) % 10)))
      + 5 + (unicode(substr(visits.client_id, -2, 1)) % 36)
    ) * 86400000 WHERE salon_id = '${salonId}';
    UPDATE clients SET
      last_visit_at = (SELECT MAX(created_at) FROM visits WHERE client_id = clients.id),
      next_reminder_at = (SELECT MAX(created_at) FROM visits WHERE client_id = clients.id) + 21 * 86400000
    WHERE salon_id = '${salonId}';`;
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'snipmemory', '--local', '--command', sql], { stdio: 'ignore' });

  console.log(`Seeded Fade Lab with ${CLIENTS.length} clients and ${n} visits.
  Owner:    demo@snipmemory.app / demo-password
  Admin:    admin@snipmemory.app / admin-password
  Stylists: Ravi PIN 1111, Maya PIN 2222 (pair a device from Team)
  Client passport: +91 98470 12345 (code is shown on screen in dev)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
