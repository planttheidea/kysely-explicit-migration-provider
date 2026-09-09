import { MigrationProvider, Migration } from 'kysely/migration';

interface ExplicitOrderMigrationProviderProps {
    importFile?: (fileName: string) => Promise<Migration>;
    migrationFolder: string;
    order: string[] | readonly string[];
}
declare class ExplicitOrderMigrationProvider implements MigrationProvider {
    #private;
    constructor(props: ExplicitOrderMigrationProviderProps);
    getMigrations(): Promise<Record<string, Migration>>;
}

export { ExplicitOrderMigrationProvider };
export type { ExplicitOrderMigrationProviderProps };
