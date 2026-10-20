import { Link } from 'react-router';
import { Logo } from '../components/icons';

// Starting-point policies for the actual data flows. Get them reviewed under India's DPDP Act 2023 before launch.
const PRIVACY: [string, string][] = [
  ['Who we are', 'SnipMemory provides billing and management software to salons. For customer records, the salon decides what is stored and SnipMemory processes it on the salon’s behalf.'],
  ['What we store', 'Owner and staff names, mobile numbers and hashed PINs; shop details and UPI ID; bills, services, products, expenses and staff payments; customer names, mobile numbers, birthdays and notes entered by the salon; optional photos of haircuts taken with the customer’s permission.'],
  ['Payments', 'SnipMemory is not a payment gateway. UPI QR codes point to the salon’s own UPI ID; we never receive or hold customer money. Subscription payments are made by UPI to SnipMemory and verified by the UTR the owner submits.'],
  ['Messages', 'We do not send SMS or WhatsApp messages. Salons send bills and reminders from their own WhatsApp when they choose to.'],
  ['Security', 'Data is stored on Cloudflare in encrypted form at rest. PINs are stored as salted hashes. Photos are private and only visible to people signed in to that shop.'],
  ['Your choices', 'A salon can delete customers (and their photos) at any time. Customers can ask the salon, or write to privacy@snipmemory.app, to see or delete their data.'],
];

const TERMS: [string, string][] = [
  ['The service', 'SnipMemory is offered on Free and paid plans. Paid plans are valid for the period paid for and are not renewed automatically.'],
  ['Payments', 'Plans are paid by UPI. A plan becomes active once we confirm your UTR. If a payment cannot be found we will tell you and the plan will not be activated.'],
  ['Your responsibilities', 'Keep your PIN secret, give staff only the access they need, take customer consent before photos, and follow GST and tax rules for your bills.'],
  ['Your data', 'Your data belongs to you. You can export bills at any time on plans that include export.'],
  ['Limits', 'We work hard to keep the service running but cannot guarantee it is never interrupted. Bills made offline are kept on the phone until they upload.'],
];

export default function Legal({ page }: { page: 'privacy' | 'terms' }) {
  const items = page === 'privacy' ? PRIVACY : TERMS;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/">
        <Logo />
      </Link>
      <h1 className="mt-8 text-4xl font-extrabold">{page === 'privacy' ? 'Privacy policy' : 'Terms of use'}</h1>
      <div className="mt-8 space-y-6">
        {items.map(([h, b]) => (
          <section key={h}>
            <h2 className="text-lg font-bold">{h}</h2>
            <p className="mt-1 leading-relaxed text-muted">{b}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
