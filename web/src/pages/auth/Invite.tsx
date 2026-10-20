import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, ErrorText, Input, PageLoader } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { AuthLayout } from './AuthLayout';

export default function Invite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { data, error } = useApi<{ email: string; role: string; salonName: string; hasAccount: boolean }>(`/api/auth/invites/${token}`);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <AuthLayout title="Invite not found">This invite link has expired or was already used. Ask the salon owner for a new one.</AuthLayout>;
  if (!data) return <PageLoader />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/auth/invites/${token}/accept`, { name: name || undefined, password });
      await refresh();
      navigate('/app');
    } catch (err) {
      setSubmitError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={`Join ${data.salonName}`} subtitle={`You've been invited as ${data.role} (${data.email}).`}>
      <form onSubmit={submit} className="space-y-4">
        {!data.hasAccount && <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} required />}
        <Input
          label={data.hasAccount ? 'Your SnipMemory password' : 'Choose a password'}
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <ErrorText error={submitError} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Accept invite
        </Button>
      </form>
    </AuthLayout>
  );
}
