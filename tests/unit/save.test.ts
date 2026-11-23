// Browser storage tests explicitly cover blocked getters, quota errors, schema checks and project-local reset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveStore, defaultSettings, loadSettings } from '../../src/save';
class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
function install(storage: MemoryStorage) { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage }); }

test('versioned round-trip and reset do not touch other apps', () => {
  const storage = new MemoryStorage(); install(storage);
  const store = new SaveStore(); const settings = defaultSettings(); settings.quality = 1;
  storage.setItem('other-app', 'keep'); assert.equal(store.write(settings), true);
  assert.equal(loadSettings(store).quality, 1); assert.equal(store.clear(), true);
  assert.equal(storage.getItem('other-app'), 'keep'); assert.equal(loadSettings(store).quality, 'auto');
});
test('a blocked localStorage getter never escapes read, write or clear', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  const store = new SaveStore(); assert.equal(store.read('fallback'), 'fallback');
  assert.equal(store.write({}), false); assert.equal(store.clear(), false); assert.equal(store.available, false);
});
test('quota, corrupted JSON and old schema fail safely', () => {
  const storage = new MemoryStorage(); install(storage); const store = new SaveStore();
  storage.setItem(store.key, '{broken'); assert.deepEqual(loadSettings(store), defaultSettings());
  storage.setItem(store.key, JSON.stringify({ version: 99, data: { quality: 0 } })); assert.equal(loadSettings(store).quality, 'auto');
  storage.setItem = () => { throw new Error('QuotaExceededError'); }; assert.equal(store.write({}), false);
});
test('settings validate quality, keys, wheel axes and retain an Escape escape hatch', () => {
  const storage = new MemoryStorage(); install(storage); const store = new SaveStore();
  store.write({ quality: 999, diagnostics: 'yes', bindings: { reset: ['KeyT'], pause: ['KeyX'], forward: [] }, wheel: { steerAxis: 99, throttleAxis: 3, deadzone: -8, forceWheel: true } });
  const settings = loadSettings(store);
  assert.equal(settings.quality, 'auto'); assert.equal(settings.diagnostics, true);
  assert.deepEqual(settings.bindings.reset, ['KeyT']); assert.deepEqual(settings.bindings.pause, ['Escape']);
  assert.deepEqual(settings.bindings.forward, ['KeyW', 'ArrowUp']);
  assert.equal(settings.wheel.steerAxis, 0); assert.equal(settings.wheel.throttleAxis, 3);
  assert.equal(settings.wheel.deadzone, 0); assert.equal(settings.wheel.forceWheel, true);
});
