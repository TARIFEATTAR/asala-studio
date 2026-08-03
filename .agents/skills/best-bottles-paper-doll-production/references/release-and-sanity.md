# Release and Sanity

## Named actions

Each action requires authenticated organization membership, `approvedByName`, a non-empty note, expected lifecycle state, and matching content hash.

1. `Approve Pixels`: accepts exact-alpha candidate pixels only.
2. `Family Fit`: accepts the candidate across every explicit compatible body plate.
3. `Lock Shared Placement`: writes one immutable transform and explicit plate rows.
4. `Cut Release`: atomically appends a content-addressed cut and advances Current Release.
5. `Sync Draft`: writes only `drafts.<documentId>` and records the returned revision.
6. `Publish Publicly`: requires a second named approval, downstream scope confirmation, and a successful draft sync for the same cut.

## Release contents

Sort component and placement version IDs before hashing. Reject mutable candidates and mixed placement truth. Incremental releases are allowed, but unresolved catalog mappings must remain visible.

The release cut, its assets, candidate state transitions, approval events, and release-head change must be one database transaction. A retry with identical content is idempotent.

## Mutation boundary

Planning, calibration, local candidate requests, review artifacts, and Sanity projections are no-write operations with respect to Current Release and production systems. Do not deploy migrations/functions, advance Current Release, sync a draft, or publish publicly without explicit authorization for that named action.
