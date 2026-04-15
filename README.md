# quakeclub-web

Código del front de [quakeclub.com](https://quakeclub.com), la plataforma
comunitaria chilena y latinoamericana de Quake Live. Incluye perfiles de
jugadores, ranking ELO, clanes, torneos (liguilla y playoffs), foro, HUDs y
noticias.

El motor de rating (Glicko-1 con modificadores propios) vive en un repo
aparte: [glicko1-quakeclub](https://github.com/foresssst/glicko1-quakeclub).

## Stack

- Next.js 16 (App Router) + React 19
- PostgreSQL + Prisma 5
- Redis (ioredis) para caché y estado live
- Tailwind 4 + shadcn/ui
- ZeroMQ para la ingesta de stats desde el servidor de Quake Live
- next-intl para i18n (es / en)
- socket.io para presencia y live feed

## Correrlo local

Necesitas Node 20+, PostgreSQL 14+ y Redis corriendo.

```bash
git clone https://github.com/foresssst/quakeclub-web.git
cd quakeclub-web
npm install
cp .env.example .env            # llenar con tus valores
npx prisma generate
npx prisma migrate deploy       # aplica migraciones a tu DB
npm run dev                     # levanta en http://localhost:3001
```

Para producción hay un `ecosystem.config.js` de PM2 listo (puerto 3000,
hostname 127.0.0.1) detrás de nginx.

## Estructura

```
app/           rutas de Next (App Router) + API handlers
components/    componentes de UI (shadcn/ui como base)
lib/           lógica compartida (steam-auth, prisma, redis, ratings, etc.)
prisma/        schema y migraciones
hooks/         hooks de React reutilizables
messages/      traducciones i18n
scripts/       scripts de mantención (cron, sync, migraciones ad-hoc)
services/      clientes externos (Twitch, YouTube, Discord)
```

## Deuda técnica conocida

- `typescript.ignoreBuildErrors: true` sigue en `next.config.mjs`. El sitio
  compila y corre, pero hay errores de tipo ocultos que quiero ir bajando.
- Algunos modelos en Prisma quedaron sin uso (`ServerSnapshot`,
  `TournamentPickBan*`); pendiente de evaluar si se eliminan o se terminan.

## Contenido que no está en el repo

El repo tiene solo código. No están:

- La carpeta `public/` entera (assets estáticos, avatares, covers, videos,
  HUDs subidos, levelshots, etc.). Si la necesitas, créala con la
  estructura que el código espera.
- La carpeta `data/` (estado runtime: news.json, sessions.json, users.json).
- Backups, dumps y logs.
- Variables de entorno con secretos.
- IPs y rutas internas del servidor de producción (todo eso vive en `.env`,
  ver `.env.example`).

Si clonas y corres local va a faltar contenido; el sitio compila igual, los
endpoints que dependan de `OUR_SERVER_IPS` o del SSH al QLDS van a
responder vacío hasta que llenes las variables.

## Licencia

MIT. Detalles en [LICENSE](LICENSE).
