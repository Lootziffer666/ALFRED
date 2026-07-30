Prebuilt browser assets from [`sql.js`](https://github.com/sql-js/sql.js) 1.14.1
(`sql-wasm.js` + `sql-wasm.wasm`), served as static files so the Archive
tool's client-side SQLite reader works without depending on a CDN at
runtime. Not an npm dependency — extracted once via `bun add sql.js` into
`node_modules`, copied here, then removed from `package.json` again since
nothing in the app imports the package directly (it's loaded as a plain
`<script>` + `initSqlJs({ locateFile })` call in `lib/sqlite/engine.ts`).
