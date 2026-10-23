# Team CRM

Team CRM is a monorepo for an internal business management platform designed to support sales, warehouse operations, account reviews, admin management, and team chat in a single application.

It consists of:
- a React frontend in `apps/web`
- an Express API in `apps/api`
- a Prisma database package in `packages/db`
- a shared UI package in `packages/ui`

## Features

- Sales lead management
- Product catalog and inventory tracking
- Order creation and fulfillment workflows
- Warehouse import/replenishment requests
- Account balance and financial review
- Admin user and request management
- Real-time team chat using Socket.IO
- Role-based workflow separation for admin, sales, warehouse, and accounts roles

## Tech Stack

- Frontend: React + Vite
- API: Node.js + Express
- Real-time: Socket.IO
- Database: PostgreSQL + Prisma
- Caching: Redis
- Authentication: JWT + cookies
- Monorepo: npm workspaces

## Repository Structure

```text
team-crm/
├─ apps/
│  ├─ api/
│  │  ├─ config/
│  │  ├─ controller/
│  │  ├─ middleware/
│  │  ├─ routes/
│  │  ├─ src/
│  │  ├─ package.json
│  │  └─ .gitignore
│  └─ web/
│     ├─ public/
│     ├─ src/
│     ├─ package.json
│     ├─ vite.config.js
│     └─ index.html
├─ packages/
│  ├─ db/
│  │  └─ prisma/
│  └─ ui/
├─ APPLICATION_OVERVIEW.md
├─ package.json
├─ prisma.config.ts
├─ .gitignore
└─ README.md
```

## Getting Started

### Prerequisites

Make sure you have installed:

- Node.js 18+
- npm
- PostgreSQL
- Redis

### Install dependencies

```bash
npm install
```

### Environment setup

Create environment files for your API and optionally frontend as needed.

Example API environment variables:

```env
PORT=5000
DATABASE_URL="postgresql://username:password@localhost:5432/teamcrm"
JWT_SECRET="your_jwt_secret"
REDIS_URL="redis://localhost:6379"
CLIENT_URL="http://localhost:5173"
```

If the frontend needs API configuration, add a `.env` file in `apps/web` as needed.

### Database setup

Generate Prisma client and push/apply schema updates:

```bash
npm run db:generate
npm run db:push
# or
npm run db
```

### Run the app

From the root directory:

```bash
npm run dev
```

This runs the API and frontend together using concurrent scripts.

### Run individual apps

```bash
npm run dev:api
npm run dev:web
```

## Available Scripts

Root scripts:

```bash
npm run dev          # run frontend + API together
npm run dev:api      # run API only
npm run dev:web      # run frontend only
npm run db           # generate + push + migrate Prisma DB
npm run db:generate
npm run db:push
npm run db:migrate
npm run socket:api    # run Socket.IO test client
npm run swagger:api  # generate API Swagger docs
```

## API

The API lives under `apps/api` and includes:

- authentication routes
- admin workflows
- sales workflows
- warehouse operations
- account management
- chat and socket handlers

Route and controller logic is organized by domain, and the app uses Prisma models to manage users, leads, products, requests, orders, rooms, and messages.

## Frontend

The frontend is built with React and Vite and lives under `apps/web/src`.

Main feature areas include:

- `features/auth` for login/registration
- `features/admin` for admin tools
- `features/sales` for leads and sales orders
- `features/warehouse` for inventory and requests
- `features/chat` for messaging UI and chat actions
- `features/accounts` for account-related views

## Application Notes

This project is a business workflow app with a lot of role-specific logic. The repository includes an architectural overview document at `APPLICATION_OVERVIEW.md`, which explains the intended product behavior and current implementation notes.

It is useful to review that document before depending on role-based permissions or production deployment assumptions.

## License

This project is currently set up without a formal public license declaration in the package metadata. Please check repository ownership and legal requirements before using it in production or distributing it publicly.

## Contributing

1. Create a feature branch
2. Make changes with proper validation
3. Run the relevant lint/build checks
4. Submit a pull request with a clear summary

## Useful Links

- `APPLICATION_OVERVIEW.md` — application architecture and intended workflow
- `apps/api/config/socket.js` — Socket.IO server setup and room events
- `packages/db/prisma/schema.prisma` — database schema

