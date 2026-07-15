import { NextResponse } from 'next/server';
import { INITIAL_CUSTOMERS } from '@/context/mockData';

// Maintain in-memory server cache for newly created customers during runtime
let serverCustomers = [...INITIAL_CUSTOMERS];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const salonId = searchParams.get('salonId') || '';
    const globalSearch = searchParams.get('global') === 'true';

    if (!salonId) {
      return NextResponse.json({ error: 'Missing salonId parameter' }, { status: 400 });
    }

    const cleanQuery = query.toLowerCase().trim();

    let matches = [];
    if (cleanQuery) {
      if (globalSearch) {
        // Global lookup (returns customers from OTHER salons matching query phone/name)
        matches = serverCustomers.filter(c => 
          c.salonId !== salonId && 
          (c.name.toLowerCase().includes(cleanQuery) || c.mobileNumber.includes(cleanQuery))
        );
      } else {
        // Local lookup (returns customers for THIS salon only)
        matches = serverCustomers.filter(c => 
          c.salonId === salonId && 
          (c.name.toLowerCase().includes(cleanQuery) || c.mobileNumber.includes(cleanQuery))
        );
      }
    } else {
      // If query is empty, return local customers for this salon (default list)
      if (!globalSearch) {
        matches = serverCustomers.filter(c => c.salonId === salonId);
      }
    }

    return NextResponse.json({ customers: matches });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, name, mobileNumber, salonId } = body;

    if (!name || !mobileNumber || !salonId) {
      return NextResponse.json({ error: 'Missing required customer parameters' }, { status: 400 });
    }

    // Check for duplicate in server memory
    const normalizedMobile = mobileNumber.replace(/\D/g, '');
    const exists = serverCustomers.some(c => 
      c.salonId === salonId && c.mobileNumber.replace(/\D/g, '') === normalizedMobile
    );

    if (exists) {
      return NextResponse.json({ error: 'Customer already exists' }, { status: 409 });
    }

    const newCustomer = {
      id: id || `cust-${Date.now()}`,
      salonId,
      name,
      mobileNumber,
      createdAt: new Date().toISOString()
    };

    serverCustomers.push(newCustomer);
    return NextResponse.json({ customer: newCustomer, success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
