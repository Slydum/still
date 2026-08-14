import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Phase 1 interaction regressions', () => {
  it('does not mark a draft dirty just for expanding More options', () => {
    const quickAdd = read('src/components/ui/QuickAddSheet.tsx');

    assert.ok(quickAdd.includes("target.closest('[aria-pressed]')"));
    assert.equal(quickAdd.includes("[aria-pressed], summary"), false);
  });

  it('keeps password and confirmation visibility independent', () => {
    const auth = read('src/features/auth/AuthPage.tsx');

    assert.ok(auth.includes('const [showPassword, setShowPassword] = useState(false);'));
    assert.ok(auth.includes('const [showConfirmation, setShowConfirmation] = useState(false);'));
    assert.ok(auth.includes("const confirmationType = showConfirmation ? 'text' : 'password';"));
    assert.ok(auth.includes('setShowConfirmation((visible) => !visible)'));
  });
});
