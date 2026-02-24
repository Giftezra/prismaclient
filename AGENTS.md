# Prisma Car Care / Prisma Valet

Mobile car valet/detailing service platform with a Django backend and React Native (Expo) client.

## Cursor Cloud specific instructions

### Architecture

- **Backend**: Django 5.2+ REST API at `server/prisma/` using SQLite3 (dev), Redis, Celery, Django Channels.
- **Client**: React Native / Expo SDK 53 app at `prisma_client/` (npm).
- Docker Compose (`docker-compose.yml`) is available but not required for local dev.

### Running the backend (Django)

```bash
cd /workspace
source venv/bin/activate
set -a && source .env && set +a
cd server/prisma
python manage.py runserver 0.0.0.0:8000
```

- Django admin: `http://localhost:8000/admin/` (credentials: `admin@dev.local` / `devpassword123`)
- API base: `http://localhost:8000/api/v1/`
- `python manage.py check` validates the Django system.
- `python manage.py migrate` applies pending migrations.

### Running the client (Expo)

```bash
cd /workspace/prisma_client
npx expo start --web --port 8081
```

- Lint: `cd prisma_client && npx expo lint`
- The Expo web build has a pre-existing error from `@stripe/stripe-react-native` (native-only module imported on web). The app is primarily intended for iOS/Android.

### Redis

Redis is required for Celery tasks (email, notifications) and Channels (WebSocket). It runs on `localhost:6379`. The Django settings hardcode the hostname `prisma_redis` for Redis, so `/etc/hosts` must map `127.0.0.1 prisma_redis` for local (non-Docker) development.

### Gotchas

- **No `.env.example`**: The `.env` file is gitignored and there is no template. Required vars: `DJANGO_SECRET_KEY`, `DEBUG=True`. See `server/prisma/prisma/settings.py` for all `os.getenv()` references.
- **Redis hostname**: Settings hardcode `prisma_redis` for Celery broker and Channels layer. Add `127.0.0.1 prisma_redis` to `/etc/hosts` for local dev without Docker.
- **Log directory**: Create `server/prisma/logs/` before running the server (Django logging writes to `logs/django.log` and `logs/django_error.log`).
- **Static files**: Run `python manage.py collectstatic --noinput` to populate `staticfiles/` for the admin panel.
- **Stripe, Microsoft Graph, Google API**: External service keys are optional for basic dev. The app degrades gracefully without them.
