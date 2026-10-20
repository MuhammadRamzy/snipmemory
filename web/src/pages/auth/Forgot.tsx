import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button, ErrorText, Input } from '../../components/ui';
import { api } from '../../lib/api';
import { AuthLayout } from './AuthLayout';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent(await api.post<{ devLink?: string }>('/api/auth/password/forgot', { email }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" footer={<Link to="/login" className="font-semibold text-accent">Back to sign in</Link>}>
      {sent ? (
        <div className="space-y-3 text-sm">
          <p>If an account exists for {email}, we've emailed a reset link. It's valid for one hour.</p>
          {sent.devLink && (
            <p className="text-muted">
              Test mode: <Link to={new URL(sent.devLink).pathname} className="font-semibold text-accent">open reset link</Link>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <ErrorText error={error} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
