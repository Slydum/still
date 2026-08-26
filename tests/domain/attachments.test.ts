import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attachmentFromEntry,
  attachmentJournalInput,
  attachmentSizeLabel,
  isAttachmentEntry,
  isSupportedAttachmentType,
} from '../../src/domain/attachments.js';
import type { JournalEntry } from '../../src/stores/useAppStore.js';

describe('lightweight attachments', () => {
  it('round-trips attachment metadata and target through a journal-backed record', () => {
    const input = attachmentJournalInput({
      name: 'receipt.jpg',
      mimeType: 'image/jpeg',
      dataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      size: 4,
      target: { kind: 'transaction', id: 'expense-1', title: 'Groceries', route: '/money' },
    });
    const entry: JournalEntry = { id: 'attachment-1', ...input, createdAt: 1, updatedAt: 2 };
    const parsed = attachmentFromEntry(entry);
    assert.equal(isAttachmentEntry(entry), true);
    assert.equal(parsed?.name, 'receipt.jpg');
    assert.equal(parsed?.target.kind, 'transaction');
    assert.equal(parsed?.target.title, 'Groceries');
  });

  it('accepts images and PDFs but rejects unrelated files', () => {
    assert.equal(isSupportedAttachmentType('image/png'), true);
    assert.equal(isSupportedAttachmentType('image/heic'), true);
    assert.equal(isSupportedAttachmentType('application/pdf'), true);
    assert.equal(isSupportedAttachmentType('application/zip'), false);
  });

  it('formats attachment sizes without pretending they are cloud-drive files', () => {
    assert.equal(attachmentSizeLabel(512), '512 B');
    assert.equal(attachmentSizeLabel(2048), '2 KB');
  });
});
