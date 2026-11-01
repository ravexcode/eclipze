# PostgreSQL performance investigation

Use this reference with the shared measurement loop in [sql-performance](../SKILL.md). It supplies PostgreSQL-specific evidence and tradeoffs; [postgresql](../../postgresql/SKILL.md) covers ordinary transactions, migrations, and recovery.

Match examples and options to the deployed server major. A `/current/` documentation link is a starting point; record the version actually used. Do not assume a monitoring extension, superuser access, or shell client is available.

## Identify what consumes the time

Separate connection acquisition, server planning/execution, lock waits, result serialization/transfer, and application processing. Record query frequency and cumulative cost as well as individual latency; a small query called excessively may dominate the workload.

Inspect relevant table, index, and total relation sizes; approximate rows; row width; data skew; write rate; and active working set. Database size does not measure how much data one query touches. Prefer existing statistics to an expensive exact full-table count unless exactness is needed.

Where already available, `pg_stat_statements` can rank statements by calls, execution time, rows, and block/temp activity over a known observation window. Its aggregate mean/max are not request percentiles. Check resets, permissions, and extension version before comparing snapshots. Enabling it can require server configuration and restart; use existing application timings or bounded query logs when it is absent. See [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html).

Use `pg_stat_activity`, wait events, and relevant table/index statistics to investigate waits and maintenance. A recorded buffer read is not necessarily a physical storage read: the operating-system cache also matters. Keep query text/parameters out of broadly shared evidence when they contain sensitive data. See [monitoring statistics](https://www.postgresql.org/docs/current/monitoring-stats.html).

## Obtain a representative plan safely

Start with ordinary `EXPLAIN` when execution has not been established as appropriate. For a known read workload on an appropriate target, a useful explicit shape is:

```sql
EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
SELECT id, created_at
FROM app.orders
WHERE customer_id = 42
ORDER BY created_at DESC, id DESC
LIMIT 100;
```

Replace the example schema/values with the actual query and representative parameters. This literal example is not proof of the application's prepared-plan behavior. Use supported options on the deployed major; add `TIMING OFF` if node timing overhead distorts a diagnostic whose purpose is row counts and I/O.

`ANALYZE` executes the statement. Inspect data-modifying CTEs, functions, triggers, and sequences even when the outer statement appears to read. Prefer an isolated representative copy for writes or uncertain effects, with external integrations disabled or substituted. A transaction followed by rollback still takes locks and consumes resources, and cannot undo sequence advancement or external effects. Never describe it as universally harmless. See [EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html) and [transaction exceptions](https://www.postgresql.org/docs/current/transaction-iso.html).

An analyzed plan measures instrumented server work. It does not include normal network delivery of the result; compare it with the real client path before attributing end-to-end improvement.

## Read the plan as evidence

| Signal | Investigation |
| --- | --- |
| Estimated rows far from actual rows | Check parameter skew, stale statistics, correlated columns, and filters before changing join methods. |
| Large rows-times-loops or join output | Find repeated work or join multiplication; preserve the required row multiplicity when rewriting. |
| Many rows removed by a filter | Check predicates and access paths; a broad query may correctly need a scan. |
| Sort/hash temp I/O or batching | Reduce unnecessary rows/width first, then assess scoped memory changes and concurrency. |
| Many heap fetches in an index-only scan | Inspect visibility and update/vacuum behavior; included columns alone do not guarantee avoiding the heap. |
| Fast server plan, slow client response | Measure pool wait, locks, transfer size, decoding, and application work separately. |

Actual rows/timing are commonly reported per loop; consider loops when estimating repeated work. Parent node costs and buffer figures can include child work, so do not add every node as independent cost. A sequential scan, nested loop, or high estimated cost is not itself a defect. See [using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html).

## Correct statistics before fighting the planner

After a large import or distribution change, check whether relevant `ANALYZE` data is current. Examine `pg_stats` and estimate errors; choose a higher column statistics target or extended statistics only for a demonstrated estimation issue. Correlated filters may benefit from dependencies or most-common-value statistics; distinct-group estimation may need `ndistinct` statistics.

Statistics remain estimates. Extended statistics have supported-clause limitations and do not automatically solve arbitrary cross-table join estimates. Confirm whether the observed estimate and plan improve after collection. See [planner statistics](https://www.postgresql.org/docs/current/planner-stats.html) and [multivariate examples](https://www.postgresql.org/docs/current/multivariate-statistics-examples.html).

If a literal query is fast but the application is slow, inspect actual bind values, parameter types, prepared execution, and generic versus custom plans. Use `EXPLAIN EXECUTE` or equivalent driver evidence where available. A temporary scoped plan-cache experiment can diagnose skew; forcing custom plans globally is not the default fix. See [PREPARE](https://www.postgresql.org/docs/current/sql-prepare.html).

## Select indexes from the workload

- Start with the predicate and required ordering. Equality conditions on leading B-tree keys and then range/order requirements are useful design inputs; verify the full plan rather than sorting columns by a universal selectivity slogan.
- Leading keys usually matter most, but do not claim later keys can never be used. Skip-scan support and its usefulness depend on server version and distribution. See [multicolumn indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html).
- Add `INCLUDE` columns only when reduced heap work justifies index size and write cost. An index-only scan still checks tuple visibility; a frequently updated table may need many heap visits. See [index-only scans](https://www.postgresql.org/docs/current/indexes-index-only-scans.html).
- Use partial or expression indexes when the query can use their predicate/expression. Verify real parameterized predicates and function/collation behavior; generic parameters can prevent proving a partial-index condition. See [partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html) and [expression indexes](https://www.postgresql.org/docs/current/indexes-expressional.html).
- Consider GIN, GiST, or BRIN only when their operators and data layout fit the observed access. An ordered B-tree remains a useful baseline for many equality/range/order workloads. Read the deployed major's [index types](https://www.postgresql.org/docs/current/indexes-types.html).
- Check existing indexes and constraint dependencies before adding or removing one. Include affected insert/update/delete latency and index size in the comparison; a read improvement can increase total workload cost.

Deploy through the project's migration path. `CREATE INDEX CONCURRENTLY` has extra scans/waits, runs outside transaction blocks, and can leave an invalid index on failure. Use it where its tradeoff fits availability, not as an unconditional index command. See [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html).

## Reduce work without changing results

Check unnecessary projection, repeated round trips, avoidable join fan-out, repeated subqueries, sort volume, and deep-offset pagination. Preserve null behavior, ties, duplicates, and visibility; use the shared SQL correctness checks before accepting a faster rewrite.

CTEs are not universally an optimization barrier. Depending on usage and volatility, the planner can fold a CTE or evaluate it separately. `NOT MATERIALIZED` may improve filter pushdown while repeating expensive computation. Compare the actual alternatives, including the deployed version's behavior. See [WITH queries](https://www.postgresql.org/docs/current/queries-with.html).

Use set-based changes or `COPY` for appropriate bulk operations, with bounded transactions/staging when needed. Keep constraints and accepted atomicity intact. Batch size trades round trips against locks, WAL, memory, and restart cost; choose it from measurements. Refresh statistics when the load changes the distribution. See [populating a database](https://www.postgresql.org/docs/current/populate.html).

## Budget memory, connections, and maintenance

`work_mem` applies to individual query operations, not the whole connection or server. Concurrent sorts/hashes, sessions, and parallel workers can multiply memory use; hash operations also use `hash_mem_multiplier`. A small isolated benchmark does not justify a large global setting. Prefer a transaction/session-scoped experiment with a total budget that leaves room for shared buffers, maintenance, the OS, and other workloads. See [resource consumption](https://www.postgresql.org/docs/current/runtime-config-resource.html).

Do not choose fixed memory percentages or connection counts without the actual host/container budget and workload. Measure application pool waits and active server concurrency; increasing connection limits can amplify contention. Keep administrative capacity and deployment-wide pool totals in view.

For write-heavy workloads, inspect long/idle transactions, dead tuples, autovacuum progress, and relevant waits. Address the condition preventing cleanup before adding more work. Normal `VACUUM` helps reuse space and visibility; `VACUUM FULL` rewrites and exclusively locks the table and needs additional disk. It is a specific space-reclamation operation, not routine tuning. See [routine vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html).

If JIT or parallel execution is implicated, compare a scoped change with representative runtimes and concurrency. Setup overhead can outweigh benefits on short work; do not turn off features globally based on one plan. See [JIT decisions](https://www.postgresql.org/docs/current/jit-decision.html) and [parallel query](https://www.postgresql.org/docs/current/parallel-query.html).

## Know when to revisit the design

For roughly 100 MB–1 GB, first establish whether a single instance with suitable queries, indexes, statistics, maintenance, and resources meets the agreed budget. Neither table count nor database bytes alone establishes a partitioning or sharding need.

Partitioning can serve measured pruning or retention/maintenance needs. It adds partition management and planning costs, and unique constraints interact with the partition key. Check queries actually prune and that retention is a domain requirement. Read [table partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) before recommending it.

Sharding distributes responsibility across database instances; local table partitioning does not. If later evidence supports distribution, record the limiting resource, candidate shard key, cross-shard operations, uniqueness, recovery, and operational burden as a separate design decision. Preserve stable keys, observability, bounded reads, and migration paths now without introducing those mechanisms early.

## Evidence to keep

Retain the query and parameter classes, server version, schema/index changes, data scale/skew, measured plan, test conditions, repetitions, result-equivalence checks, and before/after application/resource observations. Include write and maintenance costs affected by the change. Clearly separate an estimated-plan hypothesis, a local measured gain, and an observed workload improvement.
