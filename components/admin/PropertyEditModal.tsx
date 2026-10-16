import React from 'react';
import { EditModal, EditFieldConfig, EditModalProps } from './EditModal';
import { PropertyHistoryView } from './PropertyHistoryView';

const PROPERTY_EDIT_FIELDS: EditFieldConfig[] = [
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'suburb', label: 'Suburb', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'region', label: 'Region', type: 'text' },
  { key: 'postcode', label: 'Postcode', type: 'text' },
  { key: 'bedrooms', label: 'Bedrooms', type: 'number' },
  { key: 'bathrooms', label: 'Bathrooms', type: 'number' },
  { key: 'car_spaces', label: 'Car Spaces', type: 'number' },
  { key: 'year_built', label: 'Year Built', type: 'number' },
  { key: 'floor_size', label: 'Floor Size (m²)', type: 'text' },
  { key: 'land_area', label: 'Land Area', type: 'text' },
  { key: 'last_sold_price', label: 'Last Sold Price', type: 'number' },
  { key: 'last_sold_date', label: 'Last Sold Date', type: 'date' },
  { key: 'capital_value', label: 'Capital Value (RV)', type: 'number' },
  { key: 'property_url', label: 'Property URL', type: 'text' },
  { key: 'cover_image_url', label: 'Cover Image URL', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
];

interface PropertyEditModalProps extends Omit<EditModalProps, 'fields' | 'title'> {
  propertyAddress?: string;
}

export const PropertyEditModal: React.FC<PropertyEditModalProps> = ({
  isOpen,
  data,
  onClose,
  onDataChange,
  onSave,
  loading = false,
  propertyAddress = 'Property',
  maxWidth = '700px',
}) => {
  return (
    <EditModal
      isOpen={isOpen}
      title={`Edit Property - ${propertyAddress}`}
      data={data}
      fields={PROPERTY_EDIT_FIELDS}
      onClose={onClose}
      onDataChange={onDataChange}
      onSave={onSave}
      loading={loading}
      maxWidth={maxWidth}
      columns={2}
      renderExtra={() => (
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#4a5568', marginBottom: '8px' }}>
            Property History
          </label>
          <PropertyHistoryView raw={data.property_history?.toString() || ''} />
        </div>
      )}
    />
  );
};

export default PropertyEditModal;
