import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Loading } from '../components/ui';
import { date, rs, time } from '../lib/format';
import { qrSvg, upiLink } from '../lib/upi';
import { useApi } from '../lib/useApi';

interface PublicBillData {
  shop: { name: string; address: string; phone: string | null; gstin: string | null; upiVpa: string | null; upiName: string; footer: string | null };
  bill: {
    number: string;
    date: number;
    customerName: string | null;
    staffName: string;
    items: { name: string; qty: number; unitPrice: number; amount: number }[];
    subtotal: number;
    discount: number;
    tax: number;
    gst: { rate: number; cgst: number; sgst: number } | null;
    total: number;
    paid: { cash: number; upi: number; card: number; advance: number };
    due: number;
    cancelled: boolean;
  };
  customerBalance: number | null;
}

/** The bill a customer opens from WhatsApp. `?print=1` prints a 58mm/80mm thermal-friendly receipt. */
export default function PublicBill() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const print = params.get('print') === '1';
  const { data, error } = useApi<PublicBillData>(`/api/public/bills/${token}`);
  useEffect(() => {
    if (print && data) setTimeout(() => window.print(), 400);
  }, [print, data]);
  const due = data ? Math.max(0, data.bill.due) : 0;
  const pay = useMemo(() => (data?.shop.upiVpa && due > 0 ? upiLink({ vpa: data.shop.upiVpa, name: data.shop.upiName, amount: due, note: `Bill ${data.bill.number}` }) : null), [data, due]);

  if (error) return <p className="p-10 text-center text-muted">This bill link is not valid.</p>;
  if (!data) return <Loading />;
  const { shop, bill } = data;

  return (
    <div className={print ? 'mx-auto w-[72mm] bg-white p-2 font-mono text-[12px] text-black' : 'mx-auto max-w-md px-4 py-8'}>
      <div className={print ? '' : 'rounded-3xl border border-line bg-surface p-6 shadow-sm'}>
        <div className="text-center">
          <h1 className={print ? 'text-base font-bold' : 'text-2xl font-extrabold'}>{shop.name}</h1>
          {shop.address && <p className={print ? '' : 'text-muted'}>{shop.address}</p>}
          {shop.phone && <p className={print ? '' : 'text-muted'}>Ph: {shop.phone.replace(/^\+91/, '')}</p>}
          {shop.gstin && <p>GSTIN: {shop.gstin}</p>}
        </div>
        <div className={`my-3 flex justify-between ${print ? 'border-y border-dashed border-black py-1' : 'border-y border-line py-2 text-sm text-muted'}`}>
          <span>Bill #{bill.number}</span>
          <span>
            {date(bill.date)} {time(bill.date)}
          </span>
        </div>
        {bill.customerName && <p className={print ? '' : 'mb-2 font-semibold'}>Customer: {bill.customerName}</p>}
        {bill.cancelled && <p className="my-2 rounded-lg bg-danger-soft p-2 text-center font-bold text-danger">CANCELLED</p>}
        <table className="w-full">
          <tbody>
            {bill.items.map((i, k) => (
              <tr key={k} className="align-top">
                <td className="py-0.5">
                  {i.name}
                  {i.qty > 1 && ` × ${i.qty}`}
                </td>
                <td className="py-0.5 text-right tabular-nums">{rs(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={`mt-2 space-y-0.5 ${print ? 'border-t border-dashed border-black pt-1' : 'border-t border-line pt-2'}`}>
          {bill.discount > 0 && <Row l="Discount" r={`- ${rs(bill.discount)}`} />}
          {bill.gst && (
            <>
              <Row l={`CGST ${bill.gst.rate / 2}%`} r={rs(bill.gst.cgst)} />
              <Row l={`SGST ${bill.gst.rate / 2}%`} r={rs(bill.gst.sgst)} />
            </>
          )}
          <div className={`flex justify-between ${print ? 'text-sm font-bold' : 'pt-1 text-2xl font-extrabold'}`}>
            <span>Total</span>
            <span className="tabular-nums">{rs(bill.total)}</span>
          </div>
          {bill.paid.upi > 0 && <Row l="Paid (UPI)" r={rs(bill.paid.upi)} />}
          {bill.paid.cash > 0 && <Row l="Paid (Cash)" r={rs(bill.paid.cash)} />}
          {bill.paid.card > 0 && <Row l="Paid (Card)" r={rs(bill.paid.card)} />}
          {bill.paid.advance > 0 && <Row l="From advance" r={rs(bill.paid.advance)} />}
          {bill.due > 0 && <Row l="Balance due" r={rs(bill.due)} strong />}
        </div>
        <p className="mt-3 text-center">Served by {bill.staffName}</p>
        <p className="mt-1 text-center">{shop.footer || 'Thank you! Visit again.'}</p>

        {!print && pay && !bill.cancelled && (
          <div className="mt-6 rounded-3xl bg-due-soft p-5 text-center">
            <p className="font-bold text-due">Pay balance {rs(due)}</p>
            <div className="mx-auto mt-3 w-48 rounded-2xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg(pay) }} />
            <a href={pay} className="mt-3 inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-bold text-brand-ink">
              Pay with UPI app
            </a>
          </div>
        )}
      </div>
      {!print && (
        <p className="no-print mt-6 text-center text-sm text-muted">
          Bill by SnipMemory ·{' '}
          <button className="font-semibold underline" onClick={() => window.print()}>
            Print
          </button>
        </p>
      )}
    </div>
  );
}

function Row({ l, r, strong }: { l: string; r: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-bold' : ''}`}>
      <span>{l}</span>
      <span className="tabular-nums">{r}</span>
    </div>
  );
}
