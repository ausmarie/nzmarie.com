import { useCallback } from 'react';

export function useImageUpload() {
  const uploadImage = useCallback(async (file: File, docId?: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    if (docId) formData.append('doc_id', docId);

    const res = await fetch('/api/admin/reports/upload-image', {
      method: 'POST',
      body: formData,
    });

    let result: { success?: boolean; error?: string; url?: string };
    try {
      result = await res.json();
    } catch {
      throw new Error(`Upload failed (${res.status})`);
    }
    if (!res.ok || !result.success || !result.url) {
      throw new Error(result.error || `Upload failed (${res.status})`);
    }
    return result.url;
  }, []);

  const handleImageFile = useCallback((file: File, docId?: string): Promise<string> => {
    if (!file.type.startsWith('image/')) {
      return Promise.reject(new Error('Not an image file'));
    }
    if (file.size > 5 * 1024 * 1024) {
      return Promise.reject(new Error('Image too large. Max 5MB'));
    }
    return uploadImage(file, docId);
  }, [uploadImage]);

  return { uploadImage, handleImageFile };
}
