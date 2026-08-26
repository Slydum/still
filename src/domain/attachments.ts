import type { JournalEntry, JournalInput } from '../stores/useAppStore';
import { getLocalDateKey } from '../theme/stillContext';

export const ATTACHMENT_TAG = 'still-attachment';
export const MAX_ATTACHMENT_BYTES = 350_000;
export const MAX_ATTACHMENTS_PER_TARGET = 3;

export type AttachmentTarget = {
  kind: 'journal' | 'transaction';
  id: string;
  title: string;
  route: string;
};

export type AttachmentRecord = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  size: number;
  target: AttachmentTarget;
  createdAt: number;
  updatedAt: number;
};

type AttachmentPayload = {
  v: 1;
  name: string;
  mimeType: string;
  dataUrl: string;
  size: number;
  target: AttachmentTarget;
};

export function isAttachmentEntry(entry: Pick<JournalEntry, 'tags'>) {
  return entry.tags.includes(ATTACHMENT_TAG);
}

export function attachmentFromEntry(entry: JournalEntry): AttachmentRecord | undefined {
  if (!isAttachmentEntry(entry)) return undefined;
  try {
    const payload = JSON.parse(entry.body) as Partial<AttachmentPayload>;
    if (payload.v !== 1 || typeof payload.dataUrl !== 'string' || typeof payload.name !== 'string') return undefined;
    if (!payload.target || (payload.target.kind !== 'journal' && payload.target.kind !== 'transaction')) return undefined;
    return {
      id: entry.id,
      name: payload.name,
      mimeType: typeof payload.mimeType === 'string' ? payload.mimeType : 'application/octet-stream',
      dataUrl: payload.dataUrl,
      size: typeof payload.size === 'number' ? payload.size : 0,
      target: payload.target,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  } catch {
    return undefined;
  }
}

export function attachmentJournalInput(payload: Omit<AttachmentPayload, 'v'>): JournalInput {
  return {
    title: payload.name,
    body: JSON.stringify({ v: 1, ...payload } satisfies AttachmentPayload),
    entryDate: getLocalDateKey(),
    tags: [ATTACHMENT_TAG],
    areaId: payload.target.kind === 'transaction' ? 'money' : undefined,
  };
}

export function isSupportedAttachmentType(type: string) {
  return type.startsWith('image/') || type === 'application/pdf';
}

export function attachmentSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

function dataUrlByteSize(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Still could not read that file.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Still could not prepare that image.'));
    image.src = dataUrl;
  });
}

async function compressImage(file: File) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, 1440 / Math.max(1, longest));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Still could not prepare that image.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const size = dataUrlByteSize(dataUrl);
    if (size <= MAX_ATTACHMENT_BYTES) return { dataUrl, size, mimeType: 'image/jpeg' };
  }
  throw new Error('That image is still too large after compression. Choose a smaller image.');
}

export async function prepareAttachmentFile(file: File) {
  if (!isSupportedAttachmentType(file.type)) {
    throw new Error('Still supports images and small PDF files here.');
  }

  if (file.type.startsWith('image/')) {
    const prepared = await compressImage(file);
    return { name: file.name || 'Photo.jpg', ...prepared };
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`PDFs need to stay under ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB.`);
  }
  const dataUrl = await readFileAsDataUrl(file);
  return { name: file.name || 'Document.pdf', mimeType: file.type, dataUrl, size: file.size };
}
