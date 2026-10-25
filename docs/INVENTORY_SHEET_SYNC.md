# Inventory & pricing sheet sync

Source link is pending from the owner. No spreadsheet was created and no real inventory or price was invented.

IT can link an existing Google Sheets URL and its tab from `/integrations`, `/projects` or `/unit-board`. The linked Google Sheets account must have read access. All calls are server-side through the existing connection.

## Sheet columns
Required headers (any order, case-insensitive): `Project`, `Unit`, `Location`, `Size sqft`, `Price BDT`, `Status`.

One row per unique project/unit. Project, Unit and Status are required. Status must be `available`, `booked`, `sold` or `blocked`. Location, area and price can be blank; blank does not mean zero. Prices are BDT numeric values, not lakh/crore text or currency strings. Header or row errors reject the entire refresh; no partial import. Maximum 5000 listings. Existing differently named columns require mapping before activation, never guessed.

## Boundaries
Approved staff see the saved supplementary listing snapshot. Only writable authority can configure or manually refresh. Public roadmap reveals preparation only. The source and snapshots are in server-only `system_settings`, not public app_config. No changes to project_catalog, project_units, leads, availability calculations or bookings. No uploads/writes to Drive or Sheets.

Successful snapshots preserve the prior version before replacement. Failure retains the previous successful data, timestamp and a safe failure marker. Pages read the saved snapshot only, never poll Google Sheets. Manual refresh is explicit.

## Automatic schedule
Prepared callback: POST `/api/public/jobs/inventory-sheet`, managed cron bearer authentication, exact JSON body `{"kind":"hourly"}`. Proposed schedule `15 * * * *` (hourly at minute 15, UTC and Dhaka minutes coincide). May be spread up to about 30 seconds. This trades up to one hour of listing delay for limited quota and recurring cost.

Do not register or advertise an active schedule until the owner supplies the source, the first real read succeeds and this callback is published. No schedule has been registered by this change. Existing Daily Lead Report schedule is unrelated and unchanged.

Before activation, verify the real sheet through the staff UI, check row count/prices/source/timestamp, register and read back the managed schedule, and verify its first run. No real-source E2E proof is available until the link arrives.