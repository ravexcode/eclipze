---
name: sql-performance
description: "Diagnose and optimize SQLite and PostgreSQL query and workload performance. Use when a query, join, report, import, or database is slow; when reading EXPLAIN, choosing indexes, fixing spills or lock waits, benchmarking, or planning data growth. Covers roughly 100 MB–1 GB and measured growth beyond it. Not for an unlocated application bottleneck (use performance) or SQL result design alone (use sql)."
---

# SQL Performance

Improve a measured workload while preserving its result, durability, and concurrency contract. Database size is context, not a diagnosis. A 100 MB–1 GB database can require careful query work without needing partitioning or sharding.

## Frame a bounded investigation

Inspect existing SQL, schema/migrations, application timings, plans, and relevant settings. Establish:

- Engine and actual runtime/server version, driver and prepared-statement behavior, deployment/storage, CPU/memory budget, and connection/concurrency limits.
- The slow operation and its accepted result; query text/identity and representative bind values without disclosing sensitive data.
- Row counts, table/index bytes, row width, data skew, hot working set, result bytes, read/write mix, and likely growth.
- A useful target: latency at stated concurrency, import/export duration, memory ceiling, or storage/write budget. Keep this proportionate to the user's problem.

Separate pool wait, lock wait, SQL execution, result transfer, decoding/materialization, and downstream application work. Use available evidence before adding instrumentation. If the slow component is still unknown, use `performance` for that investigation; an already reproducible SQL problem does not need an arbitrary monitoring delay.

## Capture a comparable baseline

Use representative data and parameters, including large or skewed groups. Record version, schema/indexes, statistics state, settings, dataset scale, cache/warm-up conditions, concurrency, repetitions, and measurement scope. Generate or sanitize representative data when real data is unavailable; state which distributions it does not reproduce.

Measure full consumption when the caller needs the full result. Distinguish time to first row from completion. Keep a correctness result beside timing. Repeat enough to understand variance; do not infer a reliable p95/p99 from a handful of samples. Do not evict shared caches or run disruptive load just to label a run cold.

Reuse a lightweight local measurement for a bounded local task. If a representative workload cannot run, return a concrete experiment and an unverified hypothesis; never manufacture baseline numbers or a speedup.

## Inspect the actual access path safely

Start with an estimated plan if execution is uncertain. SQLite uses `EXPLAIN QUERY PLAN`; PostgreSQL uses `EXPLAIN`, optionally with execution instrumentation when appropriate.

**PostgreSQL `EXPLAIN ANALYZE` executes the statement.** Inspect data-modifying CTEs, functions, triggers, and external effects even when the top-level statement is `SELECT`. A rollback does not undo every sequence or external effect and does not remove load or lock impact. Use a representative disposable environment when live execution is not authorized or its effects are uncertain. Instrumentation itself can add overhead. See [EXPLAIN execution semantics](https://www.postgresql.org/docs/current/sql-explain.html).

Look for unnecessary rows/columns, join multiplication, repeated inner loops, poor estimates, costly sorting/grouping, temporary I/O, and contention. A scan can be correct for a small table or a broad result. Estimated cost is not elapsed time; an index appearing in the plan is not proof of improvement. SQLite's plan text is not a stable parsing API. See [PostgreSQL plan interpretation](https://www.postgresql.org/docs/current/using-explain.html) and [SQLite EQP](https://www.sqlite.org/eqp.html).

Consult only the relevant engine reference for detailed tuning:

- [SQLite](references/sqlite.md): access paths, statistics/`PRAGMA optimize`, writer contention, WAL/checkpoints, and bounded memory.
- [PostgreSQL](references/postgresql.md): plan estimates, indexes, prepared plans, memory/spills, vacuum, locks, and bulk work.

## Change the demonstrated cause

Choose the smallest plausible improvement and compare it before stacking more changes:

1. Remove unnecessary work at the right layer: narrower projections, useful bounds, repeated remote calls, or discarded intermediate rows. Preserve all required output; silently adding a `LIMIT` is not an optimization of a full export.
2. Check SQL semantics before restructuring joins, CTEs, aggregates, windows, or correlated subqueries. A rewrite is acceptable only if it preserves the intended result and consistency contract. Use `sql` for this work.
3. Choose indexes from actual predicates, join keys, ordering, selectivity, and the whole workload. Consider composite, partial, expression, or covering forms only where supported and useful. Evaluate existing overlap, write cost, disk use, build/lock behavior, and constraint ownership before changing indexes. There is no universal "most selective column first" rule.
4. Investigate stale/inadequate statistics when estimates disagree with reality. Avoid freezing plans, disabling scan methods, or forcing CTE behavior as a permanent first response.
5. Bound batch/import/export work by memory, parameter limits, transaction duration, and restart behavior. Compare sensible batch sizes rather than assuming one huge transaction or one commit per row is best.
6. Change memory, concurrency, cache, or durability settings only for a demonstrated cause with a resource/guarantee budget. PostgreSQL memory can multiply across plan operations/workers/sessions; SQLite WAL still has one writer. Global tuning recipes can worsen the workload.

Caching, denormalization, and materialized results require a freshness/invalidation contract and a measured repeated computation to remove. They are options after diagnosis, not automatic layers for a larger file.

## Compare the workload, not just the fastest query

Re-run equivalent before/after cases with comparable data, statistics, parameters, result consumption, hardware, and concurrency. Alternate runs where useful to expose warm-cache or background-load bias. Verify values, duplicate multiplicities and promised order; use an independent expected result when the baseline is itself wrong.

Measure the affected trade-offs: latency distribution/variance, total work, throughput, CPU/I/O, peak process memory, temporary files, database/index growth, WAL/checkpoint or maintenance work, and write latency. Select relevant metrics; a local one-query fix does not require a full capacity programme.

Keep the change only when the evidence meets the stated target without unacceptable regression. If measurements are inconclusive, say so and identify the smallest next observation. Avoid repeated optional experiments after the concrete uncertainty is resolved.

## Leave a practical growth path

Prefer stable domain keys, sound constraints, bounded queries/results, observable expensive operations, predictable migrations, and resumable maintenance. Add tenant/time fields because the domain needs them, not because a hypothetical sharding scheme might.

Record a measurable revisit trigger: sustained writer contention, latency outside budget at expected concurrency, a working set that exceeds resource capacity, or retention/maintenance that no longer fits its window. [Growth decisions](references/growth.md) distinguish tuning, a server database, partitioning, replicas, and eventual sharding. Implement distribution only when the accepted task and evidence justify it.

## Report evidence

Return a compact before/after comparison with workload/version, correctness proof, representative plan findings, latency/resources, costs, and the reason for keeping or rejecting each change. Distinguish measured results from suggestions. Include deployment/recovery considerations only for the actual changes; loading this skill grants no additional operational authority.
