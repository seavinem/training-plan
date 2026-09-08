# Кирил — план тренировок

Full Body ABC, цель V-taper, через день (не 4 раза в неделю).

- **В зал:** [program.md](program.md)
- **С телефона:** PWA в `app/` — после деплоя на GitHub Pages ставится с Safari на экран «Домой». Отчёт уходит сам через Cloudflare Worker; вопросы по весам — вкладка «Чат». PIN один раз, секреты на Worker, не в телефоне.
- **В Cursor:** канвас рядом с чатом — дни, веса, объём

Цикл 1 уже проставлен. Оценки (хаммер, жим сидя, бабочка, ноги, махи) подгони на первой сессии ±5 кг.

Локально: `cd app && npm install && npm run dev`.

## Телефон: Worker + PWA

Секреты только на Cloudflare Worker, не в телефоне.

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
npx wrangler secret put APP_PIN
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put CURSOR_API_KEY
npx wrangler secret put SESSION_SECRET
```

- `APP_PIN` — короткий код, тот же вводишь в приложении один раз
- `GITHUB_TOKEN` — fine-grained PAT, contents:write на `seavinem/training-plan`
- `CURSOR_API_KEY` — [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations)
- `SESSION_SECRET` — длинная случайная строка для 90-дневной сессии; не добавлять в `wrangler.toml`

Для защиты от prompt injection добавь ruleset/branch protection для `master`: Cursor GitHub App
не должен иметь bypass на изменения в `.github/**`, `app/**` и `worker/**`. Коуч с телефона
должен менять только `program.md` и `data/**`.

Потом собрать PWA с URL воркера (печатает `wrangler deploy`) и выложить `app/dist` на ветку `gh-pages`:

```powershell
$env:VITE_BASE="/training-plan/"
$env:VITE_WORKER_URL="https://gym-kiryl.kiryl-gym.workers.dev"
cd app; npm run build
```
