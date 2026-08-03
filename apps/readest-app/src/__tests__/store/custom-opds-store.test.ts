import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useCustomOPDSStore, computeOpdsCatalogContentId } from '@/store/customOPDSStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { OPDSCatalog } from '@/types/opds';
import type { SystemSettings } from '@/types/settings';
import type { EnvConfigType } from '@/services/environment';

const makeEnvConfig = (): EnvConfigType =>
  ({
    getAppService: vi.fn(),
  }) as unknown as EnvConfigType;

const makeSettings = (overrides: Partial<SystemSettings> = {}): SystemSettings =>
  ({
    opdsCatalogs: [],
    ...overrides,
  }) as unknown as SystemSettings;

beforeEach(() => {
  useCustomOPDSStore.setState({ catalogs: [], loading: false });
  useSettingsStore.setState({
    settings: makeSettings(),
    setSettings: (s: SystemSettings) => useSettingsStore.setState({ settings: s }),
    saveSettings: vi.fn(),
  } as unknown as ReturnType<typeof useSettingsStore.getState>);
  vi.clearAllMocks();
});

describe('customOPDSStore', () => {
  describe('addCatalog', () => {
    test('mints a contentId from the URL when one is not provided', () => {
      const cat = useCustomOPDSStore.getState().addCatalog({
        id: 'local-1',
        name: 'My Library',
        url: 'https://example.com/opds',
      });
      expect(cat.contentId).toBe(computeOpdsCatalogContentId('https://example.com/opds'));
      expect(cat.addedAt).toBeGreaterThan(0);
    });

    test('re-adding a soft-deleted entry mints a reincarnation token', () => {
      const first = useCustomOPDSStore.getState().addCatalog({
        id: 'l1',
        name: 'L1',
        url: 'https://example.com/opds',
      });
      useCustomOPDSStore.getState().removeCatalog(first.id);
      vi.clearAllMocks();
      const revived = useCustomOPDSStore.getState().addCatalog({
        id: 'l2',
        name: 'L1 again',
        url: 'https://example.com/opds',
      });
      expect(revived.deletedAt).toBeUndefined();
      expect(revived.reincarnation).toBeTruthy();
    });

    test('re-adding after a restart (local tombstone stripped) still revives the server row', async () => {
      // Reporter scenario (#5180): the catalog carries a server-side
      // tombstone (from a prior delete on this or another device). After
      // an app restart the local tombstone is gone — saveCustomOPDSCatalogs
      // strips deletedAt entries from persisted settings — so addCatalog
      // sees no in-memory entry and, before this fix, never minted a
      // reincarnation token. Under CRDT remove-wins the re-added catalog
      // then loses to the tombstone and vanishes on the next pull. The
      // re-add must reincarnate even though no local tombstone survives.
      const env = makeEnvConfig();
      const first = useCustomOPDSStore.getState().addCatalog({
        id: 'l1',
        name: 'L1',
        url: 'https://example.com/opds',
      });
      useCustomOPDSStore.getState().removeCatalog(first.id);
      await useCustomOPDSStore.getState().saveCustomOPDSCatalogs(env);
      // The tombstone did not survive persistence...
      expect(useSettingsStore.getState().settings.opdsCatalogs).toHaveLength(0);

      // ...so a restart hydrates an empty store.
      useCustomOPDSStore.setState({ catalogs: [], loading: false });
      await useCustomOPDSStore.getState().loadCustomOPDSCatalogs(env);
      expect(useCustomOPDSStore.getState().catalogs).toHaveLength(0);

      vi.clearAllMocks();
      const revived = useCustomOPDSStore.getState().addCatalog({
        id: 'l2',
        name: 'L1 again',
        url: 'https://example.com/opds',
      });
      expect(revived.deletedAt).toBeUndefined();
      expect(revived.reincarnation).toBeTruthy();
    });
  });

  describe('updateCatalog', () => {
    test('changing the URL recomputes contentId', () => {
      const cat = useCustomOPDSStore.getState().addCatalog({
        id: 'local-1',
        name: 'Cat',
        url: 'https://example.com/opds',
      });
      const updated = useCustomOPDSStore
        .getState()
        .updateCatalog(cat.id, { url: 'https://other.example/opds' });
      expect(updated!.contentId).toBe(computeOpdsCatalogContentId('https://other.example/opds'));
      expect(updated!.contentId).not.toBe(cat.contentId);
    });

    test('no-op on tombstoned entry', () => {
      const cat = useCustomOPDSStore.getState().addCatalog({
        id: 'l1',
        name: 'L1',
        url: 'https://example.com/opds',
      });
      useCustomOPDSStore.getState().removeCatalog(cat.id);
      vi.clearAllMocks();
      const out = useCustomOPDSStore.getState().updateCatalog(cat.id, { name: 'X' });
      expect(out).toBeUndefined();
    });
  });

  describe('removeCatalog', () => {
    test('soft-deletes and publishes the tombstone', () => {
      const cat = useCustomOPDSStore.getState().addCatalog({
        id: 'l1',
        name: 'L1',
        url: 'https://example.com/opds',
      });
      vi.clearAllMocks();
      const removed = useCustomOPDSStore.getState().removeCatalog(cat.id);
      expect(removed).toBe(true);
      const stored = useCustomOPDSStore.getState().getCatalog(cat.id);
      expect(stored?.deletedAt).toBeGreaterThan(0);
    });

    test('returns false when id is unknown', () => {
      expect(useCustomOPDSStore.getState().removeCatalog('nope')).toBe(false);
    });
  });

  describe('saveCustomOPDSCatalogs', () => {
    test('strips tombstoned entries from the persisted settings list', async () => {
      const live = useCustomOPDSStore.getState().addCatalog({
        id: 'l1',
        name: 'Live',
        url: 'https://example.com/opds',
      });
      const dead = useCustomOPDSStore.getState().addCatalog({
        id: 'l2',
        name: 'Dead',
        url: 'https://other.example/opds',
      });
      useCustomOPDSStore.getState().removeCatalog(dead.id);
      await useCustomOPDSStore.getState().saveCustomOPDSCatalogs(makeEnvConfig());
      const persisted = useSettingsStore.getState().settings.opdsCatalogs!;
      expect(persisted).toHaveLength(1);
      expect(persisted[0]!.id).toBe(live.id);
    });
  });

  describe('loadCustomOPDSCatalogs', () => {
    test('backfills contentId on legacy entries', async () => {
      const legacy: OPDSCatalog = {
        id: 'legacy-1',
        name: 'Legacy',
        url: 'https://legacy.example/opds',
      };
      useSettingsStore.setState({
        settings: makeSettings({ opdsCatalogs: [legacy] }),
      } as unknown as ReturnType<typeof useSettingsStore.getState>);
      await useCustomOPDSStore.getState().loadCustomOPDSCatalogs(makeEnvConfig());
      const inMemory = useCustomOPDSStore.getState().getCatalog('legacy-1')!;
      expect(inMemory.contentId).toBe(computeOpdsCatalogContentId('https://legacy.example/opds'));
    });

    test('preserves the existing array order via descending addedAt timestamps', async () => {
      const legacy: OPDSCatalog[] = [
        { id: 'a', name: 'Alpha', url: 'https://a.example/opds' },
        { id: 'b', name: 'Bravo', url: 'https://b.example/opds' },
        { id: 'c', name: 'Charlie', url: 'https://c.example/opds' },
      ];
      useSettingsStore.setState({
        settings: makeSettings({ opdsCatalogs: legacy }),
      } as unknown as ReturnType<typeof useSettingsStore.getState>);
      await useCustomOPDSStore.getState().loadCustomOPDSCatalogs(makeEnvConfig());
      const ordered = useCustomOPDSStore.getState().getAvailableCatalogs();
      expect(ordered.map((c) => c.id)).toEqual(['a', 'b', 'c']);
      // Strict descending — first entry strictly newer than next.
      expect(ordered[0]!.addedAt!).toBeGreaterThan(ordered[1]!.addedAt!);
      expect(ordered[1]!.addedAt!).toBeGreaterThan(ordered[2]!.addedAt!);
    });

    test('hydrates without backfilling when entries already carry contentId', async () => {
      useSettingsStore.setState({
        settings: makeSettings({
          opdsCatalogs: [
            {
              id: 'a',
              contentId: 'a',
              name: 'A',
              url: 'https://example.com/opds',
              addedAt: 1700000000000,
            },
          ],
        }),
      } as unknown as ReturnType<typeof useSettingsStore.getState>);
      await useCustomOPDSStore.getState().loadCustomOPDSCatalogs(makeEnvConfig());
      expect(useCustomOPDSStore.getState().catalogs).toHaveLength(1);
    });
  });
});
