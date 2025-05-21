# Deliveroo 🚚 🚛 📦

> [!NOTE]
>
> Exercise project for the [Developer Jutra course](https://developerjutra.pl/)
>
> This repo was cloned from the course repository
> [dj-webinars](https://github.com/developer-jutra/dj-webinars/tree/main/webinar-04-fullstack/deliveroo)

## development

    docker compose --profile dev up
    docker compose --profile dev up -d
    docker compose --profile dev up -d --build

    docker compose --profile dev down -v

URLs:

- [backend](http://localhost:3000)
- [frontend](http://localhost:4200)
- postgres
  - `docker compose exec postgres-app psql -U admin -d deliveroo`
- [pgadmin](http://localhost:5050)
  - `admin@example.com` / `adminpass` (see .env and secret/pgadmin)
  - after toggling servers: `strongpassword123`
- [grafana](http://localhost:3001)
  - `admin` / `secret` (see .env and secret/grafana)
- [redis insight (admin UI)](http://localhost:5540)

## production

    export NODE_ENV=production
    export FRONTEND_URL=https://yourdomain.com
    docker compose --profile prod up --build -d
