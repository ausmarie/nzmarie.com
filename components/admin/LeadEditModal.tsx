import React from 'react';
import { EditModal, EditFieldConfig, EditModalProps } from './EditModal';

const LEAD_EDIT_FIELDS: EditFieldConfig[] = [
  { key: 'property_address', label: 'Address', type: 'text' },
  { key: 'suburb', label: 'Suburb', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'region', label: 'Region', type: 'text' },
  { key: 'owner_name', label: 'Owner Name', type: 'text' },
  { key: 'owner_email', label: 'Owner Email', type: 'email' },
  { key: 'owner_phone', label: 'Owner Phone', type: 'text' },
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'appointment_scheduled', label: 'Appointment Scheduled' },
    { value: 'appraised', label: 'Appraised' },
    { value: 'converted', label: 'Converted' },
    { value: 'lost', label: 'Lost' },
  ]},
  { key: 'priority', label: 'Priority', type: 'select', options: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ]},
  { key: 'summary', label: 'Summary', type: 'textarea' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'next_action', label: 'Next Action', type: 'text' },
  { key: 'next_action_at', label: 'Next Action Date', type: 'date' },
  { key: 'created', label: 'Created', type: 'text' },
];

interface LeadEditModalProps extends Omit<EditModalProps, 'fields' | 'title'> {
  leadAddress?: string;
}

export const LeadEditModal: React.FC<LeadEditModalProps> = ({
  isOpen,
  data,
  onClose,
  onDataChange,
  onSave,
  loading = false,
  leadAddress = 'Lead',
  maxWidth = '700px',
}) => {
  const createdDate = (data as Record<string, unknown>).created_at || (data as Record<string, unknown>).created;
  const formattedData = {
    ...data,
    created: createdDate
      ? new Date(createdDate as string).toLocaleDateString("en-US", { year: "numeric", month: "numeric", day: "numeric" })
      : '',
  };
  return (
    <EditModal
      isOpen={isOpen}
      title={`Edit Lead - ${leadAddress}`}
      data={formattedData}
      fields={LEAD_EDIT_FIELDS}
      onClose={onClose}
      onDataChange={onDataChange}
      onSave={onSave}
      loading={loading}
      maxWidth={maxWidth}
      columns={2}
    />
  );
};

export default LeadEditModal;
