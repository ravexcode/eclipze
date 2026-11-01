# SQL Performance Quality Assurance

Assume the local optimization and ordinary benchmark review look convincing. Try to falsify whether the improvement survives the workload the application actually runs.

## QA criteria

- **Workload disguise:** replace uniform tiny data with a skewed tenant/time range, wide rows, many duplicates and a realistic result size. Look for a hot-cache result that collapses when the working set changes.
- **Measurement boundary trick:** consume all rows through the driver; include pool acquisition and decoding where the user waits for them. Check whether a reported server win merely moved cost into the client or hid truncated results.
- **Plan identity mismatch:** compare literal and application-prepared execution with selective and broad binds. Check session settings, role visibility and actual runtime versions rather than treating pasted SQL as the complete workload.
- **Read/write trade-off:** run representative writes alongside the optimized read. Probe index maintenance, lock queues, WAL/checkpoint pressure and peak memory that an isolated SELECT benchmark omits.
- **Lifecycle blind spot:** keep a reader/transaction open, interrupt a batch, reconnect a pool, or repeat the import when relevant. Probe maintenance starvation, duplicate retries, leaked settings, partial progress and recovery costs.
- **Evidence contamination:** swap test order or use comparable warmed runs. Reject apparent wins from different data, cache state, statistics, missing output, or instrumentation overhead. Report when sample size cannot support a tail-latency claim.
- **Safety hidden inside diagnostics:** examine a SELECT with a mutating function or a data-modifying CTE. Confirm that the experiment plan does not assume rollback removes all effects or that diagnostic tooling grants execution authority.
- **Scaling shortcut:** challenge a sharding/partitioning proposal with the measured limiting resource. Require a demonstrated fit and discuss new cross-boundary costs; also avoid claiming a single-node design can never need replacement.

Use bounded, disposable experiments where execution is needed. Report the counterexample, observed effect, and applicability; an unrun adversarial idea is not a discovered defect.
