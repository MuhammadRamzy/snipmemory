export type Role = 'owner' | 'manager' | 'staff';
export type Mode = 'cash' | 'upi' | 'card';
export type Capability = 'reports' | 'commission' | 'closing' | 'queue' | 'inventory' | 'gst' | 'attendance' | 'photos' | 'export' | 'multi_shop' | 'priority_support';

export interface Shop {
  id: string;
  name: string;
  shopType: 'gents' | 'unisex' | 'ladies' | 'spa';
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  upiVpa: string | null;
  upiName: string | null;
  gstEnabled: boolean;
  gstin: string | null;
  gstRate: number;
  gstInclusive: boolean;
  billPrefix: string;
  billFooter: string | null;
  staffCanDiscount: boolean;
  staffMaxDiscount: number;
  staffSeePhone: boolean;
  winbackDays: number;
  planId: string;
  planExpiresAt: number | null;
  trial: boolean;
  onboardedAt: number | null;
  suspendedAt: number | null;
  suspendedReason: string | null;
  createdAt: number;
}

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  maxStaff: number;
  monthlyBillLimit: number;
  priceMonth: number;
  priceYear: number;
  features: string[];
  capabilities: Capability[];
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string | null;
  role: Role;
  commissionPct: number;
  productCommissionPct: number;
  monthlySalary: number;
  color: string;
  active: boolean;
  createdAt: number;
}

export interface Me {
  user: { id: string; name: string; phone: string; language: string; mustChangePin: boolean } | null;
  shop: Shop;
  me: StaffMember;
  plan: Plan;
  usage: { billsThisMonth: number };
  shops: { id: string; name: string; city: string | null }[];
  impersonating: boolean;
  support: { whatsapp: string };
}

export interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  minutes: number;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  cost?: number;
  stock: number;
  lowStock: number;
  active: boolean;
}

export interface Catalog {
  services: Service[];
  products: Product[];
  staff: { id: string; name: string; color: string; role: Role }[];
  expenseCategories: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  gender: string | null;
  birthday: string | null;
  notes: string | null;
  balance: number;
  visitCount: number;
  totalSpend: number;
  lastVisitAt: number | null;
  createdAt: number;
}

export interface BillItem {
  id: string;
  kind: 'service' | 'product' | 'custom';
  refId: string | null;
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
  staffId: string;
  commission: number;
}

export interface Bill {
  id: string;
  billNo: number;
  clientRef: string;
  token: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  staffId: string;
  staffName: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidCash: number;
  paidUpi: number;
  paidCard: number;
  paidAdvance: number;
  due: number;
  note: string | null;
  day: string;
  createdAt: number;
  voided: boolean;
  voidReason: string | null;
  items: BillItem[];
}

export interface QueueItem {
  id: string;
  token: number;
  day: string;
  customerId: string | null;
  name: string;
  phone: string | null;
  staffId: string | null;
  note: string | null;
  scheduledAt: number | null;
  status: 'waiting' | 'serving' | 'done' | 'cancelled';
  billId: string | null;
  createdAt: number;
  startedAt: number | null;
}
