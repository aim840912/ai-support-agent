## Services

| Name | Port | Health URL            | Start Command |
| ---- | ---- | --------------------- | ------------- |
| Web  | 3000 | http://localhost:3000 | pnpm run dev  |

## Settings

| Key          | Value                 |
| ------------ | --------------------- |
| Base URL     | http://localhost:3000 |
| Kill Command | npx kill-port 3000    |

## Prerequisites

### Before starting Web (port 3000)

```bash
npx prisma generate
```
