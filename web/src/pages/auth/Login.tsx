import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button, ErrorText, Input } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { Me } from '../../lib/types';
import { AuthLayout } from './AuthLayout';

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post<Me>('/api/auth/login', { email, password });
      const me = await refresh();
      const next = params.get('next');
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
      navigate(safeNext ?? (me.user?.isPlatformAdmin && !me.memberships.length ? '/admin' : '/app'));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your salon."
      footer={
        <>
          New to SnipMemory? <Link to="/signup" className="font-semibold text-accent">Start free</Link>
          <br />
          Looking for your haircut history? <Link to="/passport" className="font-semibold text-accent">Open your Style Passport</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <ErrorText error={error} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
