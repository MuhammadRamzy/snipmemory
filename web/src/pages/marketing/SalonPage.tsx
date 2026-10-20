import { useParams } from 'react-router';
import { Icons, Logo } from '../../components/icons';
import { PageLoader } from '../../components/ui';
import { useApi } from '../../lib/useApi';

interface PublicSalon {
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  bookingUrl: string | null;
  brandColor: string;
}

/** Minimal public page used as the default booking link in reminders. */
export default function SalonPage() {
  const { slug } = useParams();
  const { data, error } = useApi<{ salon: PublicSalon }>(`/api/public/salons/${slug}`);
  if (error) return <div className="p-10 text-center text-muted">This salon page doesn't exist.</div>;
  if (!data) return <PageLoader />;
  const { salon } = data;
  const whatsapp = salon.phone ? `https://wa.me/${salon.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${salon.name}, I'd like to book a haircut.`)}` : null;
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-16">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        <div className="h-24" style={{ background: salon.brandColor }} />
        <div className="p-6">
          <h1 className="text-2xl font-extrabold">{salon.name}</h1>
          {(salon.address || salon.city) && <p className="mt-1 text-muted">{[salon.address, salon.city].filter(Boolean).join(', ')}</p>}
          <div className="mt-6 space-y-3">
            {salon.bookingUrl && (
              <a href={salon.bookingUrl} className="flex h-12 items-center justify-center rounded-xl text-sm font-semibold text-white" style={{ background: salon.brandColor }}>
                Book online
              </a>
            )}
            {whatsapp && (
              <a href={whatsapp} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold">
                <Icons.whatsapp size={18} /> Book on WhatsApp
              </a>
            )}
            {salon.phone && (
              <a href={`tel:${salon.phone}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold">
                <Icons.phone size={18} /> Call {salon.phone}
              </a>
            )}
          </div>
        </div>
      </div>
      <a href="/passport" className="mt-8 text-sm text-muted">
        <Logo className="text-xs" /> · See your haircut history
      </a>
    </div>
  );
}
