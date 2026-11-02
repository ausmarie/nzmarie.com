interface AddressedLead {
  property_address: string | null | undefined;
}

function normalizeAddress(address: string): string {
  return address.trim().toLocaleLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function dedupeLeadsByAddress<T extends AddressedLead>(leads: T[]): T[] {
  const seenAddresses = new Set<string>();

  return leads.filter((lead) => {
    const address = lead.property_address?.trim();
    if (!address) return true;

    const normalizedAddress = normalizeAddress(address);
    if (seenAddresses.has(normalizedAddress)) return false;

    seenAddresses.add(normalizedAddress);
    return true;
  });
}
