# Team CRM — Application Overview

> **Workspace snapshot:** 2026-11-04. This describes the implementation currently present in the workspace, including files that may not yet be committed. Check the source when behavior changes.

## What this application does

Team CRM is a browser-based business operations platform with two separate portals:

- **Employee workspace:** role-oriented sales, inventory, order fulfillment, account review, team administration, chat, and meetings.
- **Company portal:** company account management, team members, company orders, plan subscriptions, and Stripe connected-account/payment flows.

The codebase is an npm-workspaces monorepo. The API and browser client share the Prisma schema in the database package; there is no separate shared UI package.

| Workspace | Path | Responsibility |
|---|---|---|
| Web client | [`apps/web/`](./apps/web/) | React single-page app, employee and company portals |
| API | [`apps/api/`](./apps/api/) | Express HTTP API, Socket.IO, authentication, business logic and integrations |
| Database | [`packages/db/`](./packages/db/) | PostgreSQL Prisma schema and client-generation script |

## Technology

- **Frontend:** React 19, React Router 7, Vite 8, Tailwind CSS 4, Axios, Socket.IO client, Stripe.js.
- **Backend:** Node.js ES modules, Express 5, Socket.IO, Prisma 7, PostgreSQL, Redis/ioredis.
- **Integrations:** Stripe (company billing, connected accounts, and order payments), Cloudinary uploads, and ngrok forwarding.
- **Authentication:** separate employee and company JWT cookie flows.

## Run and configure locally

From the repository root:

```powershell
npm install
npm run db:generate
npm run db:push
npm run dev
```

`npm run dev` starts the API and Vite development server concurrently. Run either independently with `npm run dev:api` or `npm run dev:web`.

Root scripts also include:

| Script | Effect |
|---|---|
| `db:generate` | Generate Prisma client from `packages/db/prisma/schema.prisma` |
| `db:push` | Push the Prisma schema to the configured PostgreSQL database |
| `db:migrate` | Run Prisma's development migration command |
| `db:diff` | Ask Prisma to produce a schema diff |
| `db` | Run client generation and schema push concurrently; it is not a migration |
| `swagger:api` | Generate the API's Swagger output |
| `socket:api` | Delegate to the API package's `socket` script; no such script is currently defined |

The API listens on **port 8000** (declared in `apps/api/src/index.js`). Vite uses its default port unless overridden. API startup also starts the PostgreSQL helper, Socket.IO, subscription job, Redis message worker, and configured ngrok forwarder.

Configure local environment files; do not commit secrets. The Prisma CLI loads root `.env` first and then `apps/api/.env` if `DATABASE_URL` is unset.

| Variable | Used by |
|---|---|
| `DATABASE_URL` | Prisma PostgreSQL adapter and Prisma CLI |
| `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT` | Separate `pg` connection started by the API |
| `JWT_SECRET` | Employee and company JWTs |
| `FRONTEND_URL` | API and Socket.IO CORS; Stripe Connect onboarding return URLs |
| `VITE_API_URL` | Web API and Socket.IO server address |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe.js in company billing and sales order payment UI |
| `STRIPE_SECRET_KEY` | Stripe server SDK |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `REDIS_URL` or `REDIS_HOST` / `REDIS_PORT` | Redis connection; host/port fallback is `127.0.0.1:6379` |
| `CLOUD_NAME`, `CLOUD_KEY`, `CLOUD_SECRET` | Cloudinary avatar uploads |
| `NODE_ENV` | Company-auth cookie secure flag |
| ngrok authtoken | Read by ngrok's `authtoken_from_env` option |

The web package provides `dev`, `build`, `lint`, and `preview`. The API package provides `dev`, `start`, `swagger`, and `seed`. No package-level test script is defined.

## Web application

[`apps/web/src/main.jsx`](./apps/web/src/main.jsx) mounts the router, employee authentication, company authentication, and workspace state. [`apps/web/src/App.jsx`](./apps/web/src/App.jsx) declares route composition. Employee and company pages use separate layout components and auth contexts.

### Routes and user-facing areas

| Route | Current screen/behavior |
|---|---|
| `/`, `/dashboard` | Employee dashboard; content varies by role |
| `/home`, `/profile` | Employee home and profile |
| `/leads` | Lead list and sales/admin lead workflows |
| `/orders` | Sales order creation/payment and role-specific order views |
| `/inventory`, `/requests` | Inventory and stock-request workflows; request screen varies for Admin and Warehouse |
| `/accounts` | Account overview |
| `/chat` | Employee chat; admin chat controls are available to Admin |
| `/meetings`, `/meetings/:meetingId` | Meeting lobby and meeting room |
| `/team` | Admin employee-management screen |
| `/signin`, `/signup` | Employee authentication |
| `/company/signin`, `/company/signup` | Company-owner authentication |
| `/company`, `/company/dashboard` | Company dashboard |
| `/company/team`, `/company/orders`, `/company/wallet` | Company members, company orders, and live balance from the connected Stripe account (the wallet route currently renders this Stripe balance) |
| `/company/payments` | Stripe connected-account setup/status and payment-related company view |
| `/company/stripe/return`, `/company/stripe/refresh` | Stripe onboarding return and refresh destinations |
| `/company/subscription` | Plan selection and subscription billing |

The route wrappers hide or redirect some employee screens based on the `ADMIN`, `SALES`, `WAREHOUSE`, and `ACCOUNTS` roles. These frontend checks are for navigation and UX; API authorization is separate.

### Frontend organization

- `screens/` contains top-level employee pages and meeting screens.
- `features/` groups domain views and API helpers: accounts, admin, auth, chat, company, dashboard, meetings, sales, and warehouse.
- `context/` contains employee/company auth state, shared workspace state, and workspace-update handling.
- `components/` contains the employee/company layouts, navigation, shared UI, chat entry, logout, and upload UI.

Feature API helpers call the API using `VITE_API_URL`; cookie-authenticated requests use credentialed HTTP requests. Most business data is loaded from the API rather than persisted in the browser. The workspace context is client-side state, not the durable data store.

## API

[`apps/api/src/index.js`](./apps/api/src/index.js) creates the Express/HTTP server, registers middleware and Swagger UI when its generated file exists, installs the Stripe webhook with a raw request body, and mounts the routers below. Most employee endpoints use the employee `token` cookie (or bearer token); company endpoints use the separate `companyToken` cookie.

| Prefix | Main capabilities |
|---|---|
| `/auth` | Employee registration, login/logout, profile, avatar upload, room list and message history |
| `/admin` | Product and lead management, stock request review, employee lookup, company-wallet credit helper, and chat-room membership |
| `/sales` | Assigned leads, lead status, sales orders, order payment-intent creation and confirmation |
| `/warehouse` | Stock and fulfillment order reads, order processing/delivery, stock request reads and submissions |
| `/accounts` | Sales/account reporting and balance endpoint |
| `/company` | Company registration/login, member management, company orders and wallet, Stripe account onboarding/status/balance, subscription and recording reads |
| `/plans` | Plan listing and plan creation |
| `/payment` | Company plan-payment creation and confirmation |
| `/payment/webhook` | Stripe webhook handler, registered directly in the API entry point before JSON parsing |

The detailed route definitions live in [`apps/api/routes/`](./apps/api/routes/). `payoutController.js` is present, but there is currently no payout router mounted by the API entry point.

### Roles and accounts

Employee roles are `ADMIN`, `SALES`, `WAREHOUSE`, and `ACCOUNTS`. A company login is a separate account type with its own middleware and browser context; it is not an employee role. Company/member association is represented by the optional `User.memberOf` relation.

### Business domains and current flow

- **Sales:** Admin can create/assign leads. Sales users can view assigned leads, create orders with product items, and update lead status. The sales UI includes online payment support when the Stripe publishable key is configured.
- **Warehouse:** staff can inspect stock and orders, submit stock requests, process orders, and mark processed orders delivered.
- **Accounts:** account screens request sales/order/expense data and a balance.
- **Company administration:** company owners can manage members, review company orders, connect a Stripe account, and view its balance/status. The API also exposes a separate application-wallet endpoint, but the current wallet screen reads the Stripe connected-account balance.
- **Plans and billing:** companies can view plans and create payment intents for paid plans. Stripe payments have a creation/confirmation flow; the webhook handler is also registered directly.
- **Chat and meetings:** employees can chat in rooms and join company-associated meetings.

## Data model

The source of truth for persistence is [`packages/db/prisma/schema.prisma`](./packages/db/prisma/schema.prisma). The principal models currently defined are:

| Domain | Models |
|---|---|
| Organization and users | `Company`, `User` |
| Sales and fulfillment | `Lead`, `Order`, `OrderItem`, `Product`, `Request`, `Expenses` |
| Company funds | `Wallet` |
| Chat | `Room`, `GroupMember`, `Message` |
| Plans and billing | `Plan`, `Details`, `Subscription`, `Payment`, `OrderPayment` |
| Stripe and media records | `StripeConnectedAccount`, `Payout`, `Recordings` |

Enums include employee role, lead/order/request status, company payment status, order payment status, plan type, subscription status, payout status, and payment method. Generated Prisma client files are build output, not the schema source.

## Real-time, jobs, and external services

- **Socket.IO:** configured in `apps/api/config/socket.js`; handles chat events, workspace invalidation, and meeting signaling. The server authenticates employee sockets from the employee cookie.
- **Chat persistence:** messages are buffered through Redis and flushed to PostgreSQL by `config/worker.js`. Read-receipt state and meeting records are process-local, so they do not survive restart or synchronize between API instances.
- **Meetings:** browser WebRTC uses Socket.IO for signaling. The current implementation is process-local and uses STUN without a configured TURN service.
- **Subscription expiration:** `jobs/expireSubscriptionHandler.js` schedules expiration processing in the API process.
- **Uploads:** `config/multer.js` forwards avatar images to Cloudinary.
- **Stripe Connect:** `services/stripeConnectService.js` provisions/retrieves connected accounts and creates onboarding links. Current account creation defaults to US/USD.

## Implementation limits to keep in mind

This section records concrete constraints in the current code, not intended behavior:

- `adminMiddleware` accepts `req.body.role` as an alternative to the authenticated role. Do not treat the current admin route guard as a secure authorization boundary until corrected.
- Public employee registration accepts a role from the request. Hiding Admin in the form does not restrict direct API requests.
- The Prisma `Wallet` model is company-linked (`balanceOf`) and has no employee `userId`. Employee-wallet queries in account/request/warehouse flows therefore need review against the schema.
- Authorization and company scoping are not uniform across all employee endpoints. UI role restrictions are not a substitute for API checks or tenant filtering.
- `POST /plans` is mounted without authentication middleware.
- Read receipts and meeting state are in process memory; multi-instance deployment requires shared state and Socket.IO coordination. WebRTC may also require TURN for restrictive networks.
- Payout persistence/controller code exists, but an HTTP payout route is not mounted.

Review these constraints before production deployment and verify them as the underlying implementations evolve.

## Useful references

- [Root setup and scripts](./README.md)
- [Current repository tree](./FOLDER_STRUCTURE.md)
- [API entry point](./apps/api/src/index.js)
- [Web route definitions](./apps/web/src/App.jsx)
- [Prisma schema](./packages/db/prisma/schema.prisma)
