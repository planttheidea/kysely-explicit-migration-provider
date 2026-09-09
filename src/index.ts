import { basename, join } from 'node:path';
import { globby } from 'globby';
import type { Migration, MigrationProvider } from 'kysely/migration';

export interface ExplicitOrderMigrationProviderProps {
  importFile?: (fileName: string) => Promise<Migration>;
  migrationFolder: string;
  order: string[] | readonly string[];
}

export class ExplicitOrderMigrationProvider implements MigrationProvider {
  readonly #props: ExplicitOrderMigrationProviderProps;

  constructor(props: ExplicitOrderMigrationProviderProps) {
    this.#props = props;
  }

  async getMigrations(): Promise<Record<string, Migration>> {
    const { importFile = defaultImportFile, migrationFolder, order } = this.#props;

    const migrations: Record<string, Migration> = {};
    const files = await globby(migrationFolder);

    let remainingFiles = files.filter((file) => !file.endsWith('.test.ts'));
    let index = 0;

    for (const migrationStep of order) {
      const migrationFile = remainingFiles.find((file) => file.includes(migrationStep));

      if (!migrationFile) {
        throw new ReferenceError(`"${migrationStep}" could not be found.`);
      }

      const fileName = basename(migrationFile);

      if (!isTsFile(fileName)) {
        // Only include the name of the migration; keep it extension to avoid boilerplate.
        throw new ReferenceError(`Please update "${fileName}" to be a TypeScript file.`);
      }

      if (!matchesOrderName(fileName, migrationStep)) {
        // Safety precaution; just because it _included_ the name doesn't mean it is _exactly_ the name.
        throw new ReferenceError(`Expected "${migrationStep}" to match "${fileName}".`);
      }

      const filePath = join(migrationFolder, fileName);
      const migration = await importFile(filePath);

      if (!hasMigrationExport(migration)) {
        throw new ReferenceError(`Expected "${fileName}" to export an object.`);
      }

      // Files are expected to use named exports (default is not supported) and include both an `up` and
      // `down` method to safely handle migrations in both directions.

      if (!hasMigrationUp(migration)) {
        throw new ReferenceError(`Expected "${fileName}" to export an "up" function.`);
      }

      if (!hasMigrationDown(migration)) {
        throw new ReferenceError(`Expected "${fileName}" to export a "down" function.`);
      }

      // Pad the number to ensure ordering is respected via the native `.sort()` mechanics, because the number
      // without preceding zeroes would be something like "1, 10, 2...". Having a fixed size of 6 makes the max
      // index 999_999, and I rather hope we can keep the number of migrations to under a million.
      const orderName = String(++index).padStart(6, '0');

      migrations[`[${orderName}] ${migrationStep}`] = migration;
      remainingFiles = remainingFiles.filter((remainingFile) => remainingFile !== migrationFile);
    }

    // All files must be accounted for in the order definition.

    if (remainingFiles.length) {
      const fileNames = remainingFiles.map((remainingFile) => basename(remainingFile));

      throw new ReferenceError(
        `Expected the following files to be included in the migration order: "${fileNames.join(', ')}".`,
      );
    }

    return migrations;
  }
}

function defaultImportFile(fileName: string): Promise<Migration> {
  return import(fileName);
}

function hasMigrationDown(migrationFile: Migration): boolean {
  return typeof migrationFile.down === 'function';
}

function hasMigrationExport(migrationFile: unknown): boolean {
  return migrationFile != null && typeof migrationFile === 'object';
}

function hasMigrationUp(migrationFile: Migration): boolean {
  return typeof migrationFile.up === 'function';
}

function isTsFile(fileName: string): fileName is `${string}.ts` {
  return fileName.endsWith('.ts');
}

function matchesOrderName(fileName: `${string}.ts`, orderName: string): boolean {
  return fileName === `${orderName}.ts`;
}
