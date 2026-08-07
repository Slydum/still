import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  basePathFromUrl,
  buildAppPath,
  normalizeBaseUrl,
  stripAppBasePath,
} from '../../src/app/basePathCore.js';

describe('app base-path routing', () => {
  it('keeps root deployments at the origin root', () => {
    assert.equal(normalizeBaseUrl('/'), '/');
    assert.equal(basePathFromUrl('/'), '');
    assert.equal(buildAppPath('/', '/notifications'), '/notifications');
    assert.equal(stripAppBasePath('/', '/notifications'), '/notifications');
  });

  it('keeps every runtime path inside a nested deployment base', () => {
    assert.equal(normalizeBaseUrl('/still'), '/still/');
    assert.equal(basePathFromUrl('/still/'), '/still');
    assert.equal(buildAppPath('/still/', '/'), '/still/');
    assert.equal(buildAppPath('/still/', '/reminder-sw.js'), '/still/reminder-sw.js');
    assert.equal(buildAppPath('/still/', '/assets/auth/still-cloud-mascot.svg'), '/still/assets/auth/still-cloud-mascot.svg');
    assert.equal(buildAppPath('/still/', '/notifications'), '/still/notifications');
    assert.equal(buildAppPath('/still/', '/?checkin=now'), '/still/?checkin=now');
  });

  it('strips only the configured deployment base from browser routes', () => {
    assert.equal(stripAppBasePath('/still/', '/still/'), '/');
    assert.equal(stripAppBasePath('/still/', '/still/notifications'), '/notifications');
    assert.equal(stripAppBasePath('/still/', '/other/notifications'), '/other/notifications');
  });
});
