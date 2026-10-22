# Data Management System (Demo)

A neutral demo of a shop-floor data management app for an MSME manufacturer:
masters, production logging, job orders, quality, maintenance and stores.
Built with React (Vite) + Tailwind CSS on a Supabase (Postgres) backend.

## Structure

- [`frontend/`](frontend/) — React + Tailwind app.
- [`backend/`](backend/) — schema reference and migrations. See [backend/README.md](backend/README.md).

## Running the frontend

```
cd frontend
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

## Branding

The demo ships unbranded. To show a client logo, set `CLIENT_LOGO` and
`CLIENT_NAME` in `frontend/src/utils/constants.js`.
