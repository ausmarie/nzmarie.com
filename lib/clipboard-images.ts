export function getClipboardImageFiles(
  data: Pick<DataTransfer, 'files' | 'items'> | null
): File[] {
  if (!data) return [];

  const files = Array.from(data.files ?? []).filter((file) => file.type.startsWith('image/'));
  if (files.length > 0) return files;

  return Array.from(data.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file?.type.startsWith('image/')));
}
