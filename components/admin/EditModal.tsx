import React, { useState, useEffect } from 'react';

export interface EditFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
}

export interface EditModalProps {
  isOpen: boolean;
  title: string;
  data: Record<string, string | number | boolean | null | undefined>;
  fields: EditFieldConfig[];
  onClose: () => void;
  onDataChange: (key: string, value: string | number | boolean) => void;
  onSave: () => Promise<void>;
  loading?: boolean;
  maxWidth?: string;
  columns?: number | 'auto';
  renderExtra?: () => React.ReactNode;
}

export const EditModal: React.FC<EditModalProps> = ({
  isOpen,
  title,
  data,
  fields,
  onClose,
  onDataChange,
  onSave,
  loading = false,
  maxWidth = '700px',
  columns = 'auto',
  renderExtra,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 640);
      setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!isOpen) return null;

  const handleFieldChange = (key: string, value: string) => {
    onDataChange(key, value);
  };

  const effectiveColumns = isMobile ? 1 : (typeof columns === 'number' ? columns : undefined);
  let gridColumns = 'repeat(auto-fit, minmax(180px, 1fr))';
  
  if (effectiveColumns === 1) {
    gridColumns = '1fr';
  } else if (columns === 'auto') {
    gridColumns = fields.some(f => f.type === 'textarea') 
      ? '1fr' 
      : 'repeat(auto-fit, minmax(180px, 1fr))';
  } else if (typeof columns === 'number') {
    gridColumns = `repeat(${columns}, 1fr)`;
  }

  const modalPadding = isMobile ? '16px' : (isTablet ? '24px' : '32px');

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: isMobile ? '12px' : '16px',
          padding: modalPadding,
          maxWidth,
          width: '95%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{
          fontSize: isMobile ? '1.15rem' : '1.5rem',
          fontWeight: '700',
          color: '#2D3748',
          marginBottom: isMobile ? '16px' : '24px',
        }}>
          {title}
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: gridColumns,
          gap: '16px',
        }}>
          {fields.map((field) => (
            <div
              key={field.key}
              style={{
                gridColumn: field.type === 'textarea' ? '1 / -1' : undefined,
              }}
            >
              <label style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#4a5568',
                marginBottom: '4px',
              }}>
                {field.label}
                {field.required && <span style={{ color: '#dc2626' }}>*</span>}
              </label>

              {field.type === 'select' ? (
                <select
                  value={data[field.key]?.toString() || ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: '#2D3748',
                    backgroundColor: 'white',
                  }}
                >
                  <option value="">Select an option</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  value={data[field.key]?.toString() || ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: '#2D3748',
                    resize: 'vertical',
                  }}
                />
              ) : (
                <input
                  type={field.type}
                  value={data[field.key]?.toString() || ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: '#2D3748',
                    backgroundColor: 'white',
                    boxSizing: 'border-box',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {renderExtra && (
          <div style={{ marginTop: '16px' }}>
            {renderExtra()}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '24px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: isMobile ? '10px 16px' : '12px 24px',
              backgroundColor: '#f3f4f6',
              color: '#4a5568',
              borderRadius: '10px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: isMobile ? '0.85rem' : '0.95rem',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {isMobile ? 'Cancel' : 'Cancel'}
          </button>
          <button
            onClick={onSave}
            disabled={loading}
            style={{
              padding: isMobile ? '10px 16px' : '12px 24px',
              backgroundColor: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              borderRadius: '10px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: isMobile ? '0.85rem' : '0.95rem',
            }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
