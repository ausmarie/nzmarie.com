import { describe, it, expect } from 'vitest';
import { getClipboardImageFiles } from '../../lib/clipboard-images';

function makeFile(name: string, type: string): File {
  return { name, type } as File;
}

describe('getClipboardImageFiles', () => {
  it('returns image files from the clipboard', () => {
    const png = makeFile('screenshot.png', 'image/png');
    const pdf = makeFile('report.pdf', 'application/pdf');

    const result = getClipboardImageFiles({
      files: [pdf, png] as unknown as FileList,
      items: [] as unknown as DataTransferItemList,
    });

    expect(result).toEqual([png]);
  });

  it('falls back to clipboard items when files are unavailable', () => {
    const jpeg = makeFile('photo.jpg', 'image/jpeg');
    const png = makeFile('screenshot.png', 'image/png');

    const result = getClipboardImageFiles({
      files: [] as unknown as FileList,
      items: [
        { kind: 'string', type: 'text/plain', getAsFile: () => null },
        { kind: 'file', type: 'image/jpeg', getAsFile: () => jpeg },
        { kind: 'file', type: 'image/png', getAsFile: () => png },
      ] as unknown as DataTransferItemList,
    });

    expect(result).toEqual([jpeg, png]);
  });

  it('ignores non-image clipboard items', () => {
    const result = getClipboardImageFiles({
      files: [] as unknown as FileList,
      items: [
        { kind: 'string', type: 'text/plain', getAsFile: () => null },
        { kind: 'file', type: 'application/pdf', getAsFile: () => makeFile('report.pdf', 'application/pdf') },
      ] as unknown as DataTransferItemList,
    });

    expect(result).toEqual([]);
  });

  it('returns an empty array for missing clipboard data', () => {
    expect(getClipboardImageFiles(null)).toEqual([]);
  });
});
