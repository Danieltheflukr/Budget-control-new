# Functions Directory Audit

## Scope
Reviewed every file under `functions/` to confirm route behavior, schema compatibility, and test coverage.

## Findings and fixes

1. **Schema compatibility gap for legacy summary endpoints**
   - `get-history.js` and `get-summary.js` read `daniel_share` / `jacky_share` columns.
   - `records.js` table bootstrap previously created `records` without these columns.
   - **Fix applied:** added both columns in `ensureCoreTables` and legacy migration path in `records.js`.

2. **Inconsistent expense type in add-record API**
   - `add-record.js` defaulted `type` to `expense` (English), while stats/settlement logic expects Chinese values (`支出` / `收入`).
   - **Fix applied:** aligned defaults and validation in `add-record.js` to use the same enum as `records.js`.

3. **Input validation in add-record API**
   - Endpoint previously accepted unvalidated payloads.
   - **Fix applied:** added JSON parse handling and required field checks (`category`, `description`, `amount`, `payer_id`, `type`).

4. **Minor middleware cleanup**
   - Removed unused `env` destructuring in `_middleware.js`.

5. **Test coverage update**
   - Added `functions/api/add-record.test.js` for invalid JSON and happy-path insertion defaults.

## Outcome
The functions directory now has aligned record types, safer API validation, and compatible schema bootstrapping for endpoints that depend on share columns.
