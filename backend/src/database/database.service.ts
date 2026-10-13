import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';

/**
 * Thin wrapper over a single mssql connection pool. The SQL schema (db/ folder)
 * is the source of truth; this service runs parameterized T-SQL against it.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: sql.ConnectionPool;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const poolConfig: sql.config = {
      server: this.config.getOrThrow<string>('db.server'),
      port: this.config.getOrThrow<number>('db.port'),
      database: this.config.getOrThrow<string>('db.name'),
      user: this.config.getOrThrow<string>('db.user'),
      password: this.config.getOrThrow<string>('db.password'),
      options: {
        encrypt: this.config.get<boolean>('db.encrypt') ?? true,
        trustServerCertificate: this.config.get<boolean>('db.trustServerCert') ?? true,
      },
      pool: { max: 20, min: 0, idleTimeoutMillis: 30000 },
    };
    this.pool = await new sql.ConnectionPool(poolConfig).connect();
    this.logger.log(
      `Connected to SQL Server ${poolConfig.server}:${poolConfig.port}/${poolConfig.database}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.close();
  }

  /** Expose the mssql namespace (types, transactions) when needed. */
  get sql(): typeof sql {
    return sql;
  }

  /** A fresh request bound to the pool (for transactions / typed inputs). */
  request(): sql.Request {
    return this.pool.request();
  }

  /** Run a unit of work inside a transaction; commits on success, rolls back on error. */
  async transaction<T>(work: (tx: sql.Transaction) => Promise<T>): Promise<T> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  /** Run a parameterized query and return all rows. */
  async query<T = Record<string, unknown>>(
    text: string,
    params: Record<string, unknown> = {},
  ): Promise<T[]> {
    const req = this.pool.request();
    for (const [key, value] of Object.entries(params)) {
      req.input(key, value);
    }
    const result = await req.query<T>(text);
    return result.recordset;
  }

  /** Run a query expecting a single row (or null). */
  async queryOne<T = Record<string, unknown>>(
    text: string,
    params: Record<string, unknown> = {},
  ): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }
}
