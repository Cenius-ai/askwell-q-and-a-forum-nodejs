# Installing Askwell Q and A Forum

Askwell is a single Node.js process with a SQLite database. There is no database
server, no build step and no external service to configure.

## 1. Prerequisites (install these yourself)

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20 LTS or newer | Includes npm |
| A C toolchain for `better-sqlite3` | any recent gcc/clang + `python3` | Only needed if no prebuilt binary exists for your platform |
| `libsqlite3-dev` (Linux) | distro package | Only needed for the source build of `better-sqlite3` |

The install script never installs system packages. Install the items above with your
own package manager before continuing.

## 2. Install project dependencies, schema and demo data

From the project root:

```bash
sh install.sh
```

That script runs, in order:

1. `npm install --no-audit --no-fund` — the only package manager used is npm, matching
   the committed `package-lock.json`.
2. `node scripts/migrate.js` — creates `data/askwell.db` and every table/index if they
   are missing.
3. `node scripts/seed.js` — inserts the demo account and the sample community. It is
   idempotent: running it twice creates nothing twice.

The script exits when it is done. It never starts the web server.

## 3. Start the app

Development (nodemon, restarts on file changes):

```bash
npm run dev
```

Production-style single process:

```bash
npm start
```

The server binds `0.0.0.0` and reads `PORT` (default `3000`), so open
<http://localhost:3000>. Both commands re-check the schema and top up the seed on
boot, which means a bare `npm start` on a fresh clone with no `data/` directory also
works.

## 4. Sign in

| Email | Role | Password |
| --- | --- | --- |
| cenius@cenius.ai | Moderator | cenius |

The credentials are printed on the login card, and the "Sign in as demo" button signs
in with that account in one click.

## 5. Run the tests

```bash
npm test
```

Each test file creates and seeds its own SQLite database under `data/` (`test-*.db`),
so the suite never touches your development data. Delete those files at any time.

## Configuration (all optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind interface |
| `SESSION_SECRET` | generated once into `data/.session-secret` | Session cookie signing key; set it explicitly when running more than one process |
| `ASKWELL_DB` | `./data/askwell.db` | SQLite file, relative to the project root |
| `NODE_ENV` | `development` | `production` enables long-lived static caching |

Values come from the process environment (`.env.example` lists them for reference).
No variable is required for the app to boot.

## Troubleshooting

- **`better-sqlite3` failed to build** — install a C toolchain and Python 3, then run
  `npm rebuild better-sqlite3`.
- **`EADDRINUSE` on start** — another process already uses the port. Set `PORT` to a
  free port: `PORT=3100 npm start`.
- **Empty pages after a manual database deletion** — run `npm run seed`, or simply
  restart the server: the boot path re-seeds an empty database.
- **Sessions disappear after a restart** — sessions are stored in SQLite, so they
  survive restarts; if you changed `ASKWELL_DB` you also changed the session store.
