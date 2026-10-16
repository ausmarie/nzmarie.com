'use client';

import React from 'react';
import { getStreetLabelState, getStreetLabelColor, type AddressStatus } from '@/lib/outreach-map';

interface OutreachStreetLabelProps {
  street: string;
  addressCoords?: Array<{ status: AddressStatus }>;
}

export default function OutreachStreetLabel({ street, addressCoords }: OutreachStreetLabelProps) {
  const state = getStreetLabelState(addressCoords);
  const color = getStreetLabelColor(state);
  return (
    <div
      className="outreach-street-label"
      style={{
        padding: '2px 6px',
        borderRadius: 4,
        background: 'rgba(255,255,255,0.95)',
        color,
        fontWeight: state === 'has-unsent' ? 700 : 400,
        fontSize: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        whiteSpace: 'nowrap',
      }}
    >
      {street}
    </div>
  );
}