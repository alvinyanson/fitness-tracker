// @ts-ignore
import { DatabaseSync } from 'node:sqlite';

function normalizeParams(params: any[]): any[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

export class MockSQLiteStatement {
  private stmt: any;
  private isFinalized = false;

  constructor(stmt: any) {
    this.stmt = stmt;
  }

  executeSync<T = any>(...params: any[]) {
    if (this.isFinalized) {
      throw new Error('Cannot execute a finalized statement');
    }
    const normalized = normalizeParams(params);
    let runResult: any = { changes: 0, lastInsertRowid: 0 };
    try {
      runResult = this.stmt.run(...normalized);
    } catch {
      // If it's a statement that doesn't yield run result
    }
    const stmt = this.stmt;
    return {
      lastInsertRowId: Number(runResult?.lastInsertRowid ?? 0),
      changes: Number(runResult?.changes ?? 0),
      getFirstSync: () => (stmt.get(...normalized) ?? null) as T | null,
      getAllSync: () => (stmt.all(...normalized) ?? []) as T[],
      resetSync: () => {},
      [Symbol.iterator]: () => stmt.iterate(...normalized),
    };
  }

  finalizeSync(): void {
    this.isFinalized = true;
  }
}

export class MockSQLiteDatabase {
  readonly databasePath: string;
  private db: DatabaseSync;
  private isClosed = false;
  private inTransaction = false;

  constructor(databasePath: string) {
    this.databasePath = databasePath;
    this.db = new DatabaseSync(':memory:');
  }

  execSync(source: string): void {
    if (this.isClosed) {
      throw new Error('Database is closed');
    }
    this.db.exec(source);
  }

  runSync(source: string, ...params: any[]) {
    if (this.isClosed) {
      throw new Error('Database is closed');
    }
    const stmt = this.db.prepare(source);
    const normalized = normalizeParams(params);
    const result = stmt.run(...normalized);
    return {
      lastInsertRowId: Number(result.lastInsertRowid),
      changes: Number(result.changes),
    };
  }

  getFirstSync<T = any>(source: string, ...params: any[]): T | null {
    if (this.isClosed) {
      throw new Error('Database is closed');
    }
    const stmt = this.db.prepare(source);
    const normalized = normalizeParams(params);
    const row = stmt.get(...normalized);
    return (row ?? null) as T | null;
  }

  getAllSync<T = any>(source: string, ...params: any[]): T[] {
    if (this.isClosed) {
      throw new Error('Database is closed');
    }
    const stmt = this.db.prepare(source);
    const normalized = normalizeParams(params);
    const rows = stmt.all(...normalized);
    return (rows ?? []) as T[];
  }

  getEachSync<T = any>(source: string, ...params: any[]): IterableIterator<T> {
    if (this.isClosed) {
      throw new Error('Database is closed');
    }
    const stmt = this.db.prepare(source);
    const normalized = normalizeParams(params);
    return stmt.iterate(...normalized) as IterableIterator<T>;
  }

  prepareSync(source: string): MockSQLiteStatement {
    if (this.isClosed) {
      throw new Error('Database is closed');
    }
    const stmt = this.db.prepare(source);
    return new MockSQLiteStatement(stmt);
  }

  withTransactionSync(task: () => void): void {
    if (this.isClosed) {
      throw new Error('Database is closed');
    }
    if (this.inTransaction) {
      task();
      return;
    }
    this.inTransaction = true;
    this.db.exec('BEGIN TRANSACTION');
    try {
      task();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }

  closeSync(): void {
    if (!this.isClosed) {
      this.isClosed = true;
      try {
        this.db.close();
      } catch {
        // ignore
      }
      instances.delete(this.databasePath);
    }
  }

  isInTransactionSync(): boolean {
    return this.inTransaction;
  }
}

const instances = new Map<string, MockSQLiteDatabase>();

export function openDatabaseSync(databaseName: string): MockSQLiteDatabase {
  let instance = instances.get(databaseName);
  if (!instance) {
    instance = new MockSQLiteDatabase(databaseName);
    instances.set(databaseName, instance);
  }
  return instance;
}

export function __resetDatabaseInstances(): void {
  for (const [, instance] of instances) {
    try {
      instance.closeSync();
    } catch {
      // ignore
    }
  }
  instances.clear();
}

export const SQLiteDatabase = MockSQLiteDatabase;
export const SQLiteStatement = MockSQLiteStatement;
