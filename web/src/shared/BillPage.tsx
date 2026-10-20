import { useSession } from '../lib/session';
import { BillFlow } from './BillFlow';

export default function BillPage({ app }: { app: 'owner' | 'staff' }) {
  const { me } = useSession();
  // Re-mount per shop so a shop switch never mixes price lists.
  return <BillFlow key={me.shop.id} app={app} />;
}
