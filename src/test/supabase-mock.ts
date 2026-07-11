import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Supabase client mock.
//
// Supabase query chains (`.from().select().eq()...`) are both chainable and
// thenable. This mock reproduces that: every chain method returns the builder,
// and `.single()` / `.maybeSingle()` / awaiting the chain resolves the next
// queued result (FIFO). Tests queue results in code-execution order.
// ---------------------------------------------------------------------------

export type QueryResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

type Op = { method: string; args: unknown[] };
export type RecordedCall = { table: string; ops: Op[] };

export type SupabaseMock = {
  /** Fake client — return this from a mocked createServerClient(). */
  client: SupabaseClient;
  /** Queue one result, consumed (FIFO) by the next terminal query. */
  queueResult: (r: QueryResult) => void;
  /** Queue several results, in execution order. */
  queueResults: (rs: QueryResult[]) => void;
  /** Every .from() chain, recorded in order. */
  calls: RecordedCall[];
  /** storage `.upload()` mock — inspect calls or override behaviour. */
  uploadMock: ReturnType<typeof vi.fn>;
};

const CHAIN_METHODS = [
  "select", "insert", "update", "delete", "upsert",
  "eq", "neq", "is", "in", "not", "match", "contains",
  "gte", "lte", "gt", "lt", "like", "ilike",
  "order", "limit", "range", "filter", "or",
] as const;

function buildClient(
  results: QueryResult[],
  calls: RecordedCall[],
  uploadMock: ReturnType<typeof vi.fn>,
): SupabaseClient {
  const nextResult = (): QueryResult =>
    results.shift() ?? { data: null, error: null, count: null };

  function makeBuilder(table: string) {
    const ops: Op[] = [];
    calls.push({ table, ops });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {};
    for (const m of CHAIN_METHODS) {
      builder[m] = (...args: unknown[]) => {
        ops.push({ method: m, args });
        return builder;
      };
    }
    builder.single = () => Promise.resolve(nextResult());
    builder.maybeSingle = () => Promise.resolve(nextResult());
    // Supabase chains are awaitable directly — make the builder thenable.
    builder.then = (
      onF: ((v: QueryResult) => unknown) | null | undefined,
      onR: ((e: unknown) => unknown) | null | undefined,
    ) => Promise.resolve(nextResult()).then(onF ?? undefined, onR ?? undefined);
    return builder;
  }

  const client = {
    from: vi.fn((table: string) => makeBuilder(table)),
    // RPC (fonctions SQL : merge_owners, verify_login_code) — consomme un
    // résultat de la même file FIFO que les chaînes .from().
    rpc: vi.fn((fn: string, args: unknown) => {
      calls.push({ table: `rpc:${fn}`, ops: [{ method: "rpc", args: [args] }] });
      return Promise.resolve(nextResult());
    }),
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        getPublicUrl: vi.fn((path: string) => ({
          data: { publicUrl: `https://test.supabase.co/storage/${path}` },
        })),
      })),
    },
  };
  return client as unknown as SupabaseClient;
}

export function createSupabaseMock(): SupabaseMock {
  const results: QueryResult[] = [];
  const calls: RecordedCall[] = [];
  const uploadMock = vi.fn(() =>
    Promise.resolve({ data: { path: "uploaded" }, error: null }),
  );
  const client = buildClient(results, calls, uploadMock);
  return {
    client,
    queueResult: (r) => results.push(r),
    queueResults: (rs) => results.push(...rs),
    calls,
    uploadMock,
  };
}

/** First recorded `.from()` chain for a table. */
export function findCall(
  mock: SupabaseMock,
  table: string,
): RecordedCall | undefined {
  return mock.calls.find((c) => c.table === table);
}

/** True if any chain on `table` invoked `method` with deep-equal `args`. */
export function calledWith(
  mock: SupabaseMock,
  table: string,
  method: string,
  ...args: unknown[]
): boolean {
  return mock.calls.some(
    (c) =>
      c.table === table &&
      c.ops.some(
        (op) =>
          op.method === method &&
          JSON.stringify(op.args) === JSON.stringify(args),
      ),
  );
}
