# SQLite Performance Reference

Use with [sql-performance](../SKILL.md) for the common workload, measurement and semantic-equivalence method. [sqlite](../../sqlite/SKILL.md) owns connection, durability, migration and recovery correctness. This reference supplies engine-specific observations and tuning decisions.

## Establish the cost being measured

Capture the application's embedded SQLite version, source ID and relevant compile options. A developer CLI may have a different optimizer, extensions or diagnostics. Record journal mode, connection count, data/index/WAL sizes, row widths, useful selectivity and write rate.

For a file-backed database, these read operations help distinguish allocated pages from reusable pages:

```sql
PRAGMA page_size;
PRAGMA page_count;
PRAGMA freelist_count;
```

Page count times page size describes the main database's page footprint, not total process memory or all WAL/temporary-file storage. Include indexes and associated files in the storage budget. [Page and freelist PRAGMAs](https://www.sqlite.org/pragma.html)

Separate time waiting for a connection/lock from preparation, execution, result decoding and complete consumption. Capture write-transaction duration and checkpoint-related latency when writes are involved. Set a bounded representative execution budget; use a disposable copy for intrusive experiments.

## Inspect the plan and actual work

Use `EXPLAIN QUERY PLAN` on the actual SQL with representative bound values and matching schema/statistics. SQLite's EQP describes strategy; it does not provide PostgreSQL-style actual execution timing. Time the real workload separately. [EXPLAIN QUERY PLAN](https://www.sqlite.org/eqp.html)

Interpret the result in terms of expected work:

| Observation | Question to resolve |
| --- | --- |
| `SCAN` | Does the operation legitimately need most rows, or is a selective predicate failing to narrow the work? |
| `SEARCH` | Is the chosen range actually selective for common and unusually large parameter values? |
| Covering index | Are table lookups avoided, and is the added index width/write cost worth it? |
| Temporary B-tree | Is sorting/grouping/deduplication required, or can query shape/index order remove useful work? |
| Nested loops or correlated subquery | How many outer rows cause each inner operation, and does each inner lookup stay bounded? |
| Materialization or automatic index | Is repeated work unavoidable, or is a durable index or query change worthwhile for this workload? |

These are diagnostic clues, not pass/fail rules. A full scan or sort can be the right choice. EQP output format is not a stable application API; avoid exact text snapshots as the sole regression oracle. [Plan interpretation and stability](https://www.sqlite.org/eqp.html)

Where available, statement scan-status APIs or CLI scan statistics can compare loop estimates with measured work. `sqlite3_stmt_scanstatus` requires `SQLITE_ENABLE_STMT_SCANSTATUS`; check both library build and driver exposure. Fall back to timing and available statement counters if it is absent. [Scan-status API](https://www.sqlite.org/c3ref/stmt_scanstatus.html)

## Choose indexes from concrete access paths

- Design composite indexes around the query's equality filters, ranges and requested ordering. Test the complete query; leading-column gaps, range conditions and optimizer alternatives affect usefulness. Do not treat "most selective column first" as a universal rule. [Optimizer overview](https://www.sqlite.org/optoverview.html)
- Cover only useful columns. SQLite has no PostgreSQL-style `INCLUDE`; trailing index columns increase the index key's width. Compare read benefit with insert/update work, database size and cache pressure. [Covering indexes](https://www.sqlite.org/queryplanner.html#covidx)
- A partial index can reduce storage/write cost for a frequently queried subset. Verify that the real query predicate implies the index predicate in a form SQLite recognizes. [Partial-index applicability](https://www.sqlite.org/partialindex.html#queries_using_partial_indexes)
- Expression indexes need an appropriate deterministic expression and query-expression match; the optimizer does not generally prove algebraic equivalence. Confirm collations and comparison semantics, not just matching column names. [Expression indexes](https://www.sqlite.org/expridx.html)
- Repeated automatic indexes can identify a persistent access-path gap. Their appearance alone does not justify adding an index for a one-off report. Avoid forcing join order or `INDEXED BY` before understanding statistics and measured behavior. [Optimizer controls](https://www.sqlite.org/optoverview.html)

Example candidate for an ascending tenant event feed with non-NULL `created_at` and `id`, a stable unique `id`, and an accepted keyset-pagination contract:

```sql
CREATE INDEX events_tenant_created_id ON events(tenant_id, created_at, id);

SELECT id, created_at
FROM events
WHERE tenant_id = :tenant_id
  AND (created_at, id) > (:after_created_at, :after_id)
ORDER BY created_at, id
LIMIT :page_size;
```

The first page omits the cursor predicate. Validate page size, matching sort directions and the agreed behavior when rows change between pages. Nullable keys need an explicit policy; do not silently reuse this example. Compare its deep-page work with the existing query and preserve the required navigation behavior. [Row-value pagination](https://www.sqlite.org/rowvalue.html#scrolling_window_queries)

## Keep planner statistics appropriate

The current recommended bounded `PRAGMA optimize` behavior requires SQLite 3.46.0 or newer. Official guidance suggests optimize after schema changes, before closing short-lived connections, and periodically for long-lived connections; `PRAGMA optimize=0x10002` at initial opening broadens the tables considered. For older embedded runtimes, consult their supported behavior instead of assuming current advice applies. [ANALYZE and optimize](https://www.sqlite.org/lang_analyze.html)

Statistics maintenance may perform writes and change plans. Run it in the appropriate operating context, then remeasure representative cases. Do not repeatedly analyze the whole database on every request. If the task requires deliberately fixed planner statistics, preserve that contract rather than refreshing them silently.

Recheck skewed or correlated data after major changes. Available statistics depend on the build and analysis method; if detailed distributions are needed, verify the relevant `STAT4` support and analysis behavior. A statistics refresh is a hypothesis to test, not proof that a query became faster. [Analysis limitations](https://www.sqlite.org/lang_analyze.html#approx)

## Diagnose writer and checkpoint pressure

SQLite serializes writers. Increasing connection count can increase contention without increasing write throughput. Measure transaction duration, batch size, lock wait and write arrival rate before changing the pool. A short write queue or smaller bounded transactions may help when they preserve the required atomic unit. [SQLite isolation](https://www.sqlite.org/isolation.html)

Inspect long-lived readers when WAL growth or commit latency changes. Closing a slow cursor can release an old snapshot. Checkpoint modes have different blocking behavior; even a passive checkpoint performs I/O and may remain incomplete. Do not describe a default/passive `PRAGMA wal_checkpoint` as a read-only metric, nor force truncation after every write by default. Verify runtime support before relying on any dedicated no-op/status facility. [Checkpoint API](https://www.sqlite.org/c3ref/wal_checkpoint_v2.html)

Use the application's actual runtime, connection paths and journal mode for contention experiments. A single-threaded in-memory benchmark cannot support a concurrent file-backed throughput claim. Keep durability settings unchanged when comparing performance unless the durability change itself is explicitly part of the accepted task.

## Bound memory, imports and maintenance work

- Reuse prepared statements and batch writes within measured lock/memory budgets. Check runtime parameter limits and retry/checkpoint implications; no single row count is the correct batch size for every schema. [Implementation limits](https://www.sqlite.org/limits.html)
- Consume bounded results and avoid unnecessary wide columns. Large `RETURNING` output is buffered by SQLite, so streaming it through the driver does not make the engine's memory use constant. [RETURNING memory behavior](https://www.sqlite.org/lang_returning.html#processing_order)
- Estimate aggregate cache and temporary-work memory across active connections. `cache_size`, memory-mapped I/O and `temp_store` change different resource costs; they do not repair a bad join or provide a process-wide hard memory limit. Preserve measured headroom and read back settings. [Memory-related PRAGMAs](https://www.sqlite.org/pragma.html)
- Measure database/index size and write overhead when adding indexes. Before removing an apparently redundant index, inspect uniqueness, collation, predicates, sort order and the wider workload.
- Reusable free pages are not necessarily a performance defect. `VACUUM` is a database rebuild with lock, time and extra-space costs; use it for a demonstrated space/layout need, not as automatic query tuning. [VACUUM](https://www.sqlite.org/lang_vacuum.html)

For import-speed experiments, retain constraints and the accepted durability level. If a disposable staging database is useful, make the later validation and atomic publication/replacement semantics explicit; do not present an unsafe direct import as equivalent.

## Growth decisions

At 100 MB–1 GB, first test query shape, useful indexes, result bounds, statistics and transaction lifetimes. Measure a realistic larger data distribution when growth is relevant; do not extrapolate from one warm tiny fixture.

Record concrete limits and future triggers: sustained writer queuing, excessive working-set misses, unacceptable backup/restore time, multi-host access needs or lack of storage headroom. Consider retention/archival and a client/server database before inventing shard routing. Dataset bytes alone establish none of those needs. [Appropriate uses](https://www.sqlite.org/whentouse.html)

Deliver the before/after SQL and plan observations, parameter/data profile, comparable timings and resource costs, semantic checks and remaining uncertainty. Report an untested recommendation as a proposal, even if its plan appears promising.
