import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Camera, type CapturedPhoto } from '../../components/Camera';
import { Icons } from '../../components/icons';
import { ANGLES, PhotoGrid, TECHNIQUE_FIELDS } from '../../components/VisitCard';
import { Alert, Button, Card, CardHeader, Chip, ErrorText, Input, PageHeader, PageLoader, Select, Textarea } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { date, toMinor } from '../../lib/format';
import { useSalon } from '../../lib/salon';
import type { Angle, ClientDetail, Member, Visit } from '../../lib/types';
import { useApi } from '../../lib/useApi';

const SERVICES = ['Haircut', 'Skin fade', 'Taper fade', 'Buzz cut', 'Scissor cut', 'Beard trim', 'Cut & beard', 'Kids cut', 'Layers', 'Bob', 'Trim', 'Colour', 'Highlights', 'Perm / texture'];
const TAGS = ['Fade', 'Taper', 'Undercut', 'Crop', 'Quiff', 'Pompadour', 'Side part', 'Slick back', 'Curls', 'Textured', 'Layered', 'Blunt', 'Fringe', 'Line-up', 'Design', 'Beard shape'];

export default function NewVisit() {
  const { clientId } = useParams();
  const [params] = useSearchParams();
  const repeatId = params.get('repeat');
  const navigate = useNavigate();
  const { base, salon, viewer, canManage } = useSalon();
  const { data, error, reload } = useApi<ClientDetail>(`${base}/clients/${clientId}`);
  const team = useApi<{ members: Member[] }>(canManage ? `${base}/team` : null);

  const source: Visit | undefined = useMemo(
    () => (repeatId && data ? [...data.visits, ...data.passport.visits].find((v) => v.id === repeatId) : undefined),
    [repeatId, data],
  );

  const [service, setService] = useState('Haircut');
  const [customService, setCustomService] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [technique, setTechnique] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [products, setProducts] = useState('');
  const [price, setPrice] = useState('');
  const [memberId, setMemberId] = useState<string>(viewer.memberId ?? '');
  const [photos, setPhotos] = useState<Partial<Record<Angle, CapturedPhoto>>>({});
  const [camera, setCamera] = useState<{ angle: Angle; sequence: boolean } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [consenting, setConsenting] = useState(false);

  useEffect(() => {
    if (!source) return;
    setService(SERVICES.includes(source.service) ? source.service : 'Other');
    if (!SERVICES.includes(source.service)) setCustomService(source.service);
    setTags(source.styleTags);
    setTechnique(source.technique);
    setProducts(source.products ?? '');
  }, [source]);

  // Release preview object URLs when leaving the page.
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  if (error) return <ErrorText error={error} />;
  if (!data) return <PageLoader />;
  const { client } = data;
  const reference = Object.fromEntries((source ?? data.visits[0])?.photos.map((p) => [p.angle, p.url]) ?? []) as Partial<Record<Angle, string>>;
  const allTags = [...new Set([...TAGS, ...tags])];

  const recordConsent = async () => {
    setConsenting(true);
    try {
      await api.patch(`${base}/clients/${client.id}`, { photoConsent: true });
      await reload();
    } finally {
      setConsenting(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const captured = Object.values(photos).filter(Boolean) as CapturedPhoto[];
    if (client.photoConsent && captured.length === 0 && !window.confirm('Save without any photos? Photos are what make the cut repeatable.')) return;
    setSaving('Saving visit…');
    try {
      const { visit } = await api.post<{ visit: Visit }>(`${base}/clients/${client.id}/visits`, {
        service: service === 'Other' ? customService || 'Haircut' : service,
        styleTags: tags,
        technique: Object.fromEntries(Object.entries(technique).filter(([, v]) => v.trim())),
        notes: notes || null,
        products: products || null,
        price: toMinor(price),
        repeatOfVisitId: source?.id ?? null,
        memberId: memberId || null,
      });
      for (const [i, photo] of captured.entries()) {
        setSaving(`Uploading photo ${i + 1} of ${captured.length}…`);
        await api.put(`${base}/visits/${visit.id}/photos/${photo.angle}`, photo.blob, {
          'content-type': 'image/jpeg',
          'x-face-blurred': photo.blurred ? '1' : '0',
        });
      }
      navigate(`/app/clients/${client.id}`);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader back={`/app/clients/${client.id}`} title={source ? `Repeat cut for ${client.name}` : `New visit · ${client.name}`} />

      {source && (
        <Card className="mb-6">
          <CardHeader title="Reference: last time" description={`${source.service} · ${date(source.createdAt)}${source.salonName && source.salonName !== salon.name ? ` at ${source.salonName}` : ''}${source.stylistName ? ` by ${source.stylistName}` : ''}`} />
          <div className="space-y-3 p-5">
            <PhotoGrid photos={source.photos} />
            {source.notes && <p className="rounded-xl bg-surface-2 p-3 text-sm">{source.notes}</p>}
          </div>
        </Card>
      )}

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader
              title="Photos"
              description="Four angles make any cut repeatable."
              action={
                client.photoConsent && (
                  <Button type="button" size="sm" variant="accent" onClick={() => setCamera({ angle: 'front', sequence: true })}>
                    <Icons.camera size={16} /> Shoot all 4
                  </Button>
                )
              }
            />
            <div className="p-5">
              {!client.photoConsent ? (
                <Alert tone="warning" title="No photo consent recorded" action={<Button type="button" size="sm" onClick={recordConsent} loading={consenting}>Client agrees</Button>}>
                  Ask {client.name.split(' ')[0]} if it's OK to take photos of their haircut. They stay private to your salon.
                </Alert>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {ANGLES.map((a) => {
                    const p = photos[a.id];
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setCamera({ angle: a.id, sequence: false })}
                        className="group relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-dashed border-border bg-surface-2 transition hover:border-accent"
                      >
                        {p ? (
                          <img src={p.url} alt={`${a.label} view`} className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full flex-col items-center justify-center gap-1 text-muted">
                            <Icons.camera />
                            <span className="text-sm font-medium">{a.label}</span>
                          </span>
                        )}
                        {p && (
                          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                            {a.label} {p.blurred && <Icons.eyeOff size={11} />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="How it was cut" description="Exact settings mean anyone on the team can repeat it." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {TECHNIQUE_FIELDS.map((f) => (
                <Input key={f.id} label={f.label} placeholder={f.placeholder} value={technique[f.id] ?? ''} onChange={(e) => setTechnique((t) => ({ ...t, [f.id]: e.target.value }))} />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-4 p-5">
            <Select label="Service" value={service} onChange={(e) => setService(e.target.value)}>
              {SERVICES.map((s) => (
                <option key={s}>{s}</option>
              ))}
              <option value="Other">Other…</option>
            </Select>
            {service === 'Other' && <Input label="Service name" value={customService} onChange={(e) => setCustomService(e.target.value)} required />}
            <div>
              <p className="mb-2 text-sm font-medium">Style</p>
              <div className="flex flex-wrap gap-2">
                {allTags.map((t) => (
                  <Chip key={t} active={tags.includes(t)} onClick={() => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}>
                    {t}
                  </Chip>
                ))}
              </div>
            </div>
            <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Client wanted it shorter than usual, cowlick at crown, chatty…" rows={3} />
            <Input label="Products used" value={products} onChange={(e) => setProducts(e.target.value)} placeholder="Matte clay, sea salt spray" />
            <Input label={`Price (${salon.currency})`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Optional — powers your revenue reports" />
            {canManage && team.data && (
              <Select label="Stylist" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                {team.data.members
                  .filter((m) => m.active)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
              </Select>
            )}
          </Card>
          {saveError && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{saveError}</p>}
          <Button type="submit" size="lg" variant="accent" className="w-full" loading={Boolean(saving)}>
            {saving ?? 'Save visit'}
          </Button>
        </div>
      </form>

      {camera && (
        <Camera
          startAngle={camera.angle}
          sequence={camera.sequence}
          reference={reference}
          onCapture={(photo) => {
            previews.current.push(photo.url);
            setPhotos((cur) => ({ ...cur, [photo.angle]: photo }));
          }}
          onClose={() => setCamera(null)}
        />
      )}
    </div>
  );
}
