// Starter price lists so a new shop can bill in the first minute. Owners edit them freely.
// Prices in rupees; typical small-town/tier-2 rates.

type Item = [name: string, category: string, rupees: number, minutes: number];

const GENTS: Item[] = [
  ['Haircut', 'Hair', 100, 20],
  ['Shave', 'Beard', 50, 15],
  ['Beard trim', 'Beard', 60, 15],
  ['Haircut + Shave', 'Combo', 140, 35],
  ['Haircut + Beard', 'Combo', 150, 35],
  ['Kids haircut', 'Hair', 80, 20],
  ['Hair wash', 'Hair', 50, 10],
  ['Head massage', 'Massage', 100, 15],
  ['Hair colour', 'Colour', 300, 40],
  ['Beard colour', 'Colour', 150, 20],
  ['Hair spa', 'Spa', 400, 40],
  ['Face cleanup', 'Face', 300, 30],
  ['Facial', 'Face', 600, 45],
  ['De-tan', 'Face', 400, 30],
];

const LADIES: Item[] = [
  ['Haircut', 'Hair', 300, 30],
  ['Eyebrow threading', 'Threading', 50, 10],
  ['Upper lip', 'Threading', 30, 5],
  ['Full face threading', 'Threading', 150, 20],
  ['Hair wash & blow dry', 'Hair', 300, 30],
  ['Hair spa', 'Spa', 800, 45],
  ['Root touch-up', 'Colour', 800, 45],
  ['Global colour', 'Colour', 2500, 90],
  ['Cleanup', 'Face', 500, 30],
  ['Facial', 'Face', 1200, 60],
  ['Waxing – full arms', 'Waxing', 300, 20],
  ['Waxing – full legs', 'Waxing', 500, 30],
  ['Manicure', 'Hands & feet', 500, 30],
  ['Pedicure', 'Hands & feet', 700, 40],
  ['Bridal makeup', 'Makeup', 8000, 180],
];

export function defaultServices(type: 'gents' | 'unisex' | 'ladies' | 'spa'): Item[] {
  if (type === 'gents') return GENTS;
  if (type === 'ladies') return LADIES;
  if (type === 'spa') return [['Head massage', 'Massage', 300, 30], ['Body massage (60 min)', 'Massage', 1500, 60], ['Foot reflexology', 'Massage', 600, 30], ...LADIES.filter(([, c]) => c === 'Face')];
  const rename = (items: Item[], who: string): Item[] => items.map(([n, c, r, m]) => [n === 'Haircut' ? `${who} haircut` : n, c, r, m]);
  return [...rename(GENTS.slice(0, 8), 'Gents'), ...rename(LADIES.slice(0, 8), 'Ladies')];
}

export const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Products & stock', 'Tea & snacks', 'Salary', 'Cleaning', 'Repairs', 'Water', 'Internet & phone', 'Other'];
