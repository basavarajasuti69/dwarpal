# Dwarpal OS frontend

This Next.js App Router application contains the Dwarpal query studio and audit trail. For architecture, backend setup, environment variables, deployment, and security limitations, see the [repository README](../README.md).

## Run locally

```bash
npm install
```

Set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` in `.env.local`, then run:

```bash
npm run dev
```

Visit `http://localhost:3000`. The API must be running separately.
