# kysely-explicit-migration-provider

Migration provider for `kysely` that allows explicit ordering of migration files.

## Why

`kysely`'s built-in `FileMigrationProvider` sorts migrations by filename, so the order has to be encoded in the names
themselves — the `20240115T093000_` prefixes you end up scrolling past to read what a step actually does. This provider
takes the order as a list instead, so files are named for what they do and the sequence lives in one place you can read
top to bottom.

The list is also a contract. A name in the order with no matching file, or a file the order never mentions, throws
instead of quietly migrating a different set than you meant to.

## Installation

```sh
npm install @planttheidea/kysely-explicit-migration-provider
```

`kysely` is a peer dependency; the version already in your project is the one used.

## Usage

```ts
import { join } from 'node:path';
import { Migrator } from 'kysely/migration';
import { ExplicitOrderMigrationProvider } from '@planttheidea/kysely-explicit-migration-provider';

const MIGRATION_ORDER = ['createUserTable', 'createWidgetTable', 'addWidgetOwner'] as const;

const migrator = new Migrator({
  db,
  provider: new ExplicitOrderMigrationProvider({
    migrationFolder: join(import.meta.dirname, 'steps'),
    order: MIGRATION_ORDER,
  }),
});

const { error, results } = await migrator.migrateToLatest();
```

Each file in `steps/` is named exactly as it appears in `order` — `createUserTable.ts` — and exports both `up` and
`down`:

```ts
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('user')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('user').execute();
}
```

Migration names handed to `kysely` are prefixed with a zero-padded index (`[000001] createUserTable`) so that the
`migration` table sorts in the order you declared, not alphabetically.

## Options

| Option            | Type                                       | Default            | Description                                                       |
| ----------------- | ------------------------------------------ | ------------------ | ----------------------------------------------------------------- |
| `migrationFolder` | `string`                                   | —                  | Absolute path to the folder holding the migration files.          |
| `order`           | `string[] \| readonly string[]`            | —                  | Migration names, in the order they should run.                    |
| `importFile`      | `(fileName: string) => Promise<Migration>` | dynamic `import()` | How a migration file is loaded. Override for a bundler or a test. |

## Errors

The provider throws a `ReferenceError` rather than migrating a set you did not ask for:

- a name in `order` matches no file in `migrationFolder`
- a file in `migrationFolder` is missing from `order`
- a matched file is not a `.ts` file
- a matched file's name is not exactly its `order` entry plus `.ts`
- a matched file exports no object, or is missing `up` or `down`

`.test.ts` files in the folder are ignored, so a step's tests can sit next to it.
