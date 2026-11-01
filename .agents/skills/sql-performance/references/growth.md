# Growth without premature distribution

Use data size together with row width, working set, concurrent work, write rate, latency and operational limits. Roughly 100 MB–1 GB is this skill family's starting workload, not an engine limit or a partitioning threshold.

## Decisions that help now and later

- Keep stable primary keys and enforce actual ownership/relationship rules. Define tenant or time boundaries when the domain has them; avoid speculative shard columns and global ID machinery.
- Keep queries and application memory bounded. Design sequential exports/backfills so they can resume from a stable key under a stated consistency model.
- Retain migrations, useful query/lock/pool measurements, and a tested restore path appropriate to the data. Make retention rules explicit before storage pressure forces an emergency deletion.
- Isolate database access at sensible application boundaries. Do not promise that a generic abstraction makes SQLite/PostgreSQL SQL or concurrency semantics interchangeable.

## Choose a response to the limiting resource

| Evidence | Candidate response | What must still be checked |
| --- | --- | --- |
| Excessive rows, repeated work, missing useful access path | Query/index/statistics changes | Correctness, write cost, full application latency |
| Unbounded result/working memory | Projection, pagination/streaming, bounded batches | Full-result requirements, driver buffering, snapshot lifetime |
| CPU, memory or storage capacity limits on an otherwise sound design | Right-size the host/storage and tune the measured bottleneck | Actual budget, bottleneck movement, operating costs |
| SQLite writer contention or multi-host database access no longer fits | Shorter writes/batching first; evaluate a server database where needed | Locking, deployment, driver and SQL migration; size alone is insufficient |
| PostgreSQL reads exhaust capacity while stale reads are acceptable | Query/result reuse or a read replica, if justified | Freshness, replica lag, read-after-write behavior, failover and operating cost |
| Retention or selective time/tenant access benefits from smaller physical pieces | Evaluate PostgreSQL partitioning | Pruning with real predicates, key/uniqueness restrictions, partition count, maintenance |
| Measured capacity/availability requirements exceed a viable single-node design | Evaluate distribution/sharding as separate design work | Shard key/skew, cross-shard joins/transactions, uniqueness, routing, resharding, backup/restore |

This is a decision aid, not a required ladder. Do not create a replica to solve a write bottleneck, or partitions to repair an unbounded client result.

SQLite's [engine-selection guidance](https://www.sqlite.org/whentouse.html) emphasizes deployment and concurrency. PostgreSQL [partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) can help pruning and retention, but splitting a table into partitions does not automatically distribute it across servers. Validate deployed-version restrictions before a design relies on them.

## Make the future trigger concrete

Record an observation and a revisit condition, not an arbitrary "shard at N GB" rule. For example: "The existing design meets the agreed import and read-latency budgets at expected concurrent load. Revisit writer architecture if measured write-queue delay remains above its budget after transaction/batch changes."

Use actual measured numbers when available. Do not fabricate a threshold, a growth forecast, or a benchmark. A design can be ready for future investigation without implementing that future architecture today.
