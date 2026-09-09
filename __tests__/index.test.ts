import { createHash } from 'node:crypto';
import { globby } from 'globby';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ExplicitOrderMigrationProvider } from '../src/index.js';

vi.mock('globby', async () => {
  const actual = await vi.importActual('globby');

  return { ...actual, globby: vi.fn() };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('getMigrations', () => {
  test('returns migrations involved', async () => {
    const migrationFolder = '/my/repo';
    const files = ['foo', 'bar'].map((name) => `${migrationFolder}/${name}.ts`);

    vi.mocked(globby).mockResolvedValueOnce(files);

    const importFile = vi.fn().mockResolvedValue({ down: vi.fn(), up: vi.fn() });
    const provider = new ExplicitOrderMigrationProvider({
      importFile,
      migrationFolder,
      order: ['foo', 'bar'],
    });

    const migrations = await provider.getMigrations();

    expect(importFile.mock.calls).toEqual(files.map((file) => [file]));

    expect(migrations).toEqual({
      '[000001] foo': expect.objectContaining({
        down: expect.any(Function),
        up: expect.any(Function),
      }),
      '[000002] bar': expect.objectContaining({
        down: expect.any(Function),
        up: expect.any(Function),
      }),
    });
  });

  test('sorts files based on order', async () => {
    const migrationFolder = '/my/repo';
    const order = Array.from({ length: 57 }, (_, index) =>
      createHash('sha256')
        .update(`file ${String(index)}`)
        .digest('hex')
        .slice(0, 6),
    );
    const files = order.map((name) => `${migrationFolder}/${name}.ts`);

    vi.mocked(globby).mockResolvedValueOnce(files);

    const importFile = vi.fn().mockResolvedValue({ down: vi.fn(), up: vi.fn() });
    const provider = new ExplicitOrderMigrationProvider({ importFile, migrationFolder, order });

    const migrations = await provider.getMigrations();
    const sortedKeys = Object.keys(migrations).sort();

    sortedKeys.forEach((key, index) => {
      const re = new RegExp(`^\\[${String(index + 1).padStart(6, '0')}\\] [0-9a-f]{6}$`);

      expect(key).toMatch(re);
    });
  });

  describe('error conditions', () => {
    test('file is missing in folder', async () => {
      const migrationFolder = '/my/repo';
      const files = ['foo'].map((name) => `${migrationFolder}/${name}.ts`);

      vi.mocked(globby).mockResolvedValueOnce(files);

      const importFile = vi.fn().mockResolvedValue({ down: vi.fn(), up: vi.fn() });
      const provider = new ExplicitOrderMigrationProvider({
        importFile,
        migrationFolder,
        order: ['foo', 'bar'],
      });

      await expect(() => provider.getMigrations()).rejects.toThrow(new ReferenceError('"bar" could not be found.'));
    });

    test('file is missing in order declaration', async () => {
      const migrationFolder = '/my/repo';
      const files = ['foo', 'bar'].map((name) => `${migrationFolder}/${name}.ts`);

      vi.mocked(globby).mockResolvedValueOnce(files);

      const importFile = vi.fn().mockResolvedValue({ down: vi.fn(), up: vi.fn() });
      const provider = new ExplicitOrderMigrationProvider({
        importFile,
        migrationFolder,
        order: ['foo'],
      });

      await expect(() => provider.getMigrations()).rejects.toThrow(
        new ReferenceError('Expected the following files to be included in the migration order: "bar.ts".'),
      );
    });

    test('file is not a TS file', async () => {
      const migrationFolder = '/my/repo';
      const files = ['foo'].map((name) => `${migrationFolder}/${name}.js`);

      vi.mocked(globby).mockResolvedValueOnce(files);

      const importFile = vi.fn().mockResolvedValue({ down: vi.fn(), up: vi.fn() });
      const provider = new ExplicitOrderMigrationProvider({
        importFile,
        migrationFolder,
        order: ['foo', 'bar'],
      });

      await expect(() => provider.getMigrations()).rejects.toThrow(
        new ReferenceError('Please update "foo.js" to be a TypeScript file.'),
      );
    });

    test('file exports nothing', async () => {
      const migrationFolder = '/my/repo';
      const files = ['foo'].map((name) => `${migrationFolder}/${name}.ts`);

      vi.mocked(globby).mockResolvedValueOnce(files);

      const importFile = vi.fn().mockResolvedValue(undefined);
      const provider = new ExplicitOrderMigrationProvider({
        importFile,
        migrationFolder,
        order: ['foo', 'bar'],
      });

      await expect(() => provider.getMigrations()).rejects.toThrow(
        new ReferenceError('Expected "foo.ts" to export an object.'),
      );
    });

    test('file does not export an `up` method', async () => {
      const migrationFolder = '/my/repo';
      const files = ['foo'].map((name) => `${migrationFolder}/${name}.ts`);

      vi.mocked(globby).mockResolvedValueOnce(files);

      const importFile = vi.fn().mockResolvedValue({ down: vi.fn() });
      const provider = new ExplicitOrderMigrationProvider({
        importFile,
        migrationFolder,
        order: ['foo', 'bar'],
      });

      await expect(() => provider.getMigrations()).rejects.toThrow(
        new ReferenceError('Expected "foo.ts" to export an "up" function.'),
      );
    });

    test('file does not export a `down` method', async () => {
      const migrationFolder = '/my/repo';
      const files = ['foo'].map((name) => `${migrationFolder}/${name}.ts`);

      vi.mocked(globby).mockResolvedValueOnce(files);

      const importFile = vi.fn().mockResolvedValue({ up: vi.fn() });
      const provider = new ExplicitOrderMigrationProvider({
        importFile,
        migrationFolder,
        order: ['foo', 'bar'],
      });

      await expect(() => provider.getMigrations()).rejects.toThrow(
        new ReferenceError('Expected "foo.ts" to export a "down" function.'),
      );
    });
  });
});
