import { MarketingLayout } from './MarketingLayout';

// NOTE: starting-point policies written for the product's actual data flows.
// Have them reviewed by counsel for each launch market (GDPR/UK GDPR, India DPDP Act 2023, CCPA, UAE PDPL).

const PRIVACY = [
  ['Who we are', 'SnipMemory provides software that salons and barbershops ("salons") use to keep records of their clients\' haircuts. For client records the salon is the data controller and SnipMemory acts as its processor. For Style Passport accounts and our own salon customers, SnipMemory is the controller.'],
  ['What we store', 'Salon accounts: owner and team names, emails, phone numbers and hashed passwords/PINs. Client records (entered by salons): name, mobile number, optional email and notes, visit details (services, technique notes, products, prices) and haircut photos taken with the client\'s consent. Messaging logs of reminders and verification codes (codes themselves are never stored in readable form).'],
  ['How photos are protected', 'Photos are stored in private object storage and are only served to signed-in members of the salon that took them, to the client themself, and to other salons the client has explicitly approved with a one-time code. Salons can blur faces on the device before upload.'],
  ['Messages', 'Salons may send rebooking reminders to clients who agreed to receive them. Every reminder includes a one-tap opt-out link, and clients can turn reminders off per salon in their Style Passport.'],
  ['Your rights', 'Clients can view and download their data, revoke sharing, stop reminders and erase their data at any salon from the Style Passport at /passport. Salons can export and erase client records. Contact privacy@snipmemory.app for any other request; we respond within 30 days.'],
  ['Sub-processors', 'Cloudflare (hosting, database and storage), Stripe (payments), Meta WhatsApp Business Platform and Twilio (message delivery).'],
  ['Retention', 'Salon data is kept while the salon\'s account exists and deleted within 30 days of account closure. Message delivery logs are kept for 13 months, verification-code logs for 30 days.'],
];

const TERMS = [
  ['The service', 'SnipMemory is provided to salons on a subscription basis. The Free plan is provided as-is with the limits shown on the pricing page.'],
  ['Your responsibilities', 'You must obtain each client\'s consent before taking photos or sending reminders, use the service lawfully, and keep your team\'s credentials and PINs secure.'],
  ['Billing', 'Paid plans renew automatically each month or year until cancelled. You can cancel any time; your plan stays active until the end of the paid period, after which the account moves to the Free plan. Purchased message credits are non-refundable and do not expire.'],
  ['Your data', 'You own your salon\'s data. You can export it at any time. We only use it to provide the service.'],
  ['Availability', 'We aim for high availability but do not guarantee uninterrupted service. Planned maintenance is announced in the app.'],
  ['Liability', 'To the extent permitted by law, our liability is limited to the fees you paid in the 12 months before a claim.'],
];

export default function Legal({ page }: { page: 'privacy' | 'terms' }) {
  const sections = page === 'privacy' ? PRIVACY : TERMS;
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight">{page === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}</h1>
        <div className="mt-10 space-y-8">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-2 leading-relaxed text-muted">{body}</p>
            </section>
          ))}
        </div>
      </article>
    </MarketingLayout>
  );
}
