import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, ErrorText, Input } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthLayout } from './AuthLayout';

export default function Reset() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/password/reset', { token, password });
      await refresh();
      navigate('/app');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="You'll be signed out on all other devices.">
      <form onSubmit={submit} className="space-y-4">
        <Input label="New password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        <ErrorText error={error} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Save and sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
