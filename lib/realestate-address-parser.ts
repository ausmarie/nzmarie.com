export interface ParsedRealestateAddress {
  street: string;
  suburb: string | null;
  city: string | null;
}

export function parseRealestateAddress(fullAddress: string): ParsedRealestateAddress {
  if (!fullAddress) return { street: '', suburb: null, city: null };

  const parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length >= 3) {
    const city = parts.pop() || null;
    const suburb = parts.pop() || null;
    const street = parts.join(', ');
    return { street, suburb, city };
  }

  if (parts.length === 2) {
    const city = parts.pop() || null;
    const street = parts[0];
    return { street, suburb: null, city };
  }

  return { street: parts[0] || fullAddress, suburb: null, city: null };
}
