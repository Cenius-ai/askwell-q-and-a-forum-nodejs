# Using askwell-q-and-a-forum

## Overview

Askwell Q and A Forum — a self-hosted, server-rendered Q&A community (Apache Answer-style) built with Express, EJS and SQLite.

## Quickstart

After completing the install steps in `INSTALL.md`:

```bash
npm run dev    # start the server
# in another terminal:
curl http://localhost:8000/
```

## Endpoints

Every endpoint below was extracted from the source by the route scanner (Next.js / FastAPI / Flask / Django / Express).

| Method | Path | Source file |
|--------|------|-------------|
| `GET` | `/` | `src/routes/questions.js` |
| `GET` | `/answers/:id/edit` | `src/routes/answers.js` |
| `GET` | `/dashboard` | `src/routes/dashboard.js` |
| `GET` | `/health` | `src/app.js` |
| `GET` | `/login` | `src/routes/auth.js` |
| `GET` | `/questions/:id` | `src/routes/questions.js` |
| `GET` | `/questions/:id/edit` | `src/routes/questions.js` |
| `GET` | `/questions/new` | `src/routes/questions.js` |
| `GET` | `/signup` | `src/routes/auth.js` |
| `GET` | `/tags` | `src/routes/tags.js` |
| `GET` | `/tags/:slug` | `src/routes/tags.js` |
| `POST` | `/answers/:id` | `src/routes/answers.js` |
| `POST` | `/answers/:id/accept` | `src/routes/answers.js` |
| `POST` | `/answers/:id/delete` | `src/routes/answers.js` |
| `POST` | `/answers/:id/vote` | `src/routes/answers.js` |
| `POST` | `/login` | `src/routes/auth.js` |
| `POST` | `/login/demo` | `src/routes/auth.js` |
| `POST` | `/logout` | `src/routes/auth.js` |
| `POST` | `/questions` | `src/routes/questions.js` |
| `POST` | `/questions/:id` | `src/routes/questions.js` |
| `POST` | `/questions/:id/answers` | `src/routes/questions.js` |
| `POST` | `/questions/:id/close` | `src/routes/questions.js` |
| `POST` | `/questions/:id/delete` | `src/routes/questions.js` |
| `POST` | `/questions/:id/reopen` | `src/routes/questions.js` |
| `POST` | `/questions/:id/vote` | `src/routes/questions.js` |
| `POST` | `/signup` | `src/routes/auth.js` |
| `POST` | `/tags/:id/follow` | `src/routes/tags.js` |

### curl examples

#### `GET /`

```bash
curl http://localhost:8000/
```

#### `GET /answers/:id/edit`

```bash
curl http://localhost:8000/answers/1/edit
```

#### `GET /dashboard`

```bash
curl http://localhost:8000/dashboard
```

#### `GET /health`

```bash
curl http://localhost:8000/health
```

#### `GET /login`

```bash
curl http://localhost:8000/login
```

## Worked example

1. Boot the server (`npm run dev`).
2. Hit a smoke-test endpoint:

```bash
curl -sS http://localhost:8000/
```

3. If you get a JSON / HTML response, the server is healthy. Inspect `.env` if it errors with an auth/config failure.

## Reference

### Entry points

| Kind | Name | Source |
|------|------|--------|
| Library entry | `askwell-q-and-a-forum` | `server.js` (package.json) |

### Surface index (auto-extracted)

| Kind | Title | Source file |
|------|-------|-------------|
| route | `GET /` | `src/routes/questions.js` |
| route | `GET /answers/:id/edit` | `src/routes/answers.js` |
| route | `GET /dashboard` | `src/routes/dashboard.js` |
| route | `GET /health` | `src/app.js` |
| route | `GET /login` | `src/routes/auth.js` |
| route | `GET /questions/:id` | `src/routes/questions.js` |
| route | `GET /questions/:id/edit` | `src/routes/questions.js` |
| route | `GET /questions/new` | `src/routes/questions.js` |
| route | `GET /signup` | `src/routes/auth.js` |
| route | `GET /tags` | `src/routes/tags.js` |
| route | `GET /tags/:slug` | `src/routes/tags.js` |
| route | `POST /answers/:id` | `src/routes/answers.js` |
| route | `POST /answers/:id/accept` | `src/routes/answers.js` |
| route | `POST /answers/:id/delete` | `src/routes/answers.js` |
| route | `POST /answers/:id/vote` | `src/routes/answers.js` |
| route | `POST /login` | `src/routes/auth.js` |
| route | `POST /login/demo` | `src/routes/auth.js` |
| route | `POST /logout` | `src/routes/auth.js` |
| route | `POST /questions` | `src/routes/questions.js` |
| route | `POST /questions/:id` | `src/routes/questions.js` |
| route | `POST /questions/:id/answers` | `src/routes/questions.js` |
| route | `POST /questions/:id/close` | `src/routes/questions.js` |
| route | `POST /questions/:id/delete` | `src/routes/questions.js` |
| route | `POST /questions/:id/reopen` | `src/routes/questions.js` |
| route | `POST /questions/:id/vote` | `src/routes/questions.js` |
| route | `POST /signup` | `src/routes/auth.js` |
| route | `POST /tags/:id/follow` | `src/routes/tags.js` |

## Next steps

- Read [INSTALL.md](./INSTALL.md) if anything in the Quickstart didn't work.
- Inspect `.env.example` for the full list of environment variables this project understands.
- See [README.md](./README.md) for the architecture diagram + feature list.
