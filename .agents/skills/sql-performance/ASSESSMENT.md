# SQL Performance Assessment

Review the optimization against the actual workload and accepted guarantees. Do not reward an index, shorter SQL, or a particular plan node by itself.

## Review criteria

- **Diagnosis:** evidence locates the cost in execution, pool/lock waits, transfer, application materialization, or maintenance. The proposed change addresses that mechanism.
- **Baseline identity:** version, schema/indexes, statistics, representative binds/skew, data scale, cache state, concurrency, repetitions, and full-result scope are sufficient to reproduce the comparison.
- **Meaning preserved:** row values/multiplicities, ordering, tenant scope, transaction atomicity, and consistency match the accepted behavior. A required export was not made faster by returning less data.
- **Plan reasoning:** estimates, actual rows/loops where available, access paths, sorting/spills and repeated work support the hypothesis. Plans use the real driver/preparation mode where it matters; a scan or CTE is not automatically a defect.
- **Index/statistics economics:** key order and specialized index choices fit the predicates and workload. Build/lock behavior, storage, write cost, existing overlap and constraint support were considered before adoption/removal.
- **Resource scope:** settings and pool/batch changes account for effective scope, concurrency and memory multiplication; durability, constraints, or maintenance were not silently weakened.
- **Experiment safety:** diagnostic execution and benchmark load fit the authorized environment. `EXPLAIN ANALYZE` side effects and rollback limits were handled before execution.
- **Outcome evidence:** before/after results meet the target with acceptable relevant regressions and credible variance. Proposals, fixtures, estimated costs and measured speedups are clearly distinguished.
- **Growth proportionality:** future recommendations have workload-based triggers and preserve useful boundaries without requiring partitioning or sharding because of a byte count.

## Assessment output

Identify the mechanism, strongest evidence, trade-offs and any unverified claim. If a necessary comparison is missing, state precisely which conclusion it limits; do not invent measurements or demand unrelated load tests.
