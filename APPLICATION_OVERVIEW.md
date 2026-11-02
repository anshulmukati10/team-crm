# Team CRM — Application Overview

> **Repository snapshot reviewed:** 2026-10-30
> This document describes the code currently in this repository. It distinguishes working implementation from intended workflows and known gaps; it is not a claim that every feature is production-ready.

## 1. Product and repository at a glance

Team CRM is a business-workflow application for company workspaces. Its domains include employee accounts, sales leads and orders, product inventory, warehouse stock requests, account reporting, team chat, subscription plans, and company payments.

The repository is an npm-workspaces monorepo:

| Area | Path | Current responsibility |
|---|---|---|
| Browser application | [`apps/web/`](./apps/web/) | React single-page app, Vite, Tailwind CSS, role-specific workspace screens |
| HTTP and socket server | [`apps/api/`](./apps/api/) | Express API, user/company authentication, business controllers, Socket.IO, Redis jobs, Stripe integration |
| Database package | [`packages/db/`](./packages/db/) | PostgreSQL Prisma schema and Prisma client generation |
| Repository docs | [`README.md`](./README.md), [`APPLICATION_OVERVIEW.md`](./APPLICATION_OVERVIEW.md) | Setup notes and implementation overview |

The root `package.json` declares workspaces for `apps/*` and `packages/*`. The present repository contains the API, web, and database packages; it does **not** contain the shared `packages/ui` package mentioned in the README's example tree.

## 2. Technology and runtime

- **Web:** React 19, React Router 7, Vite 8, Tailwind CSS 4, Axios, Socket.IO client.
- **API:** Node.js ES modules, Express 5, Socket.IO, cookie-parser, CORS.
- **Persistence:** PostgreSQL through Prisma 7 and the Prisma PostgreSQL adapter.
- **Other services:** Redis through ioredis; Stripe PaymentIntents and webhooks; ngrok forwarding.
- **Authentication:** JWTs in HttpOnly cookies for employee and company sessions; bcrypt password hashing at account creation/login.

The API listens on **port 8000**, which is hard-coded in [`apps/api/src/index.js`](./apps/api/src/index.js). Vite's port is not explicitly configured in [`apps/web/vite.config.js`](./apps/web/vite.config.js), so its normal Vite default applies unless overridden by the invocation.

The API's `/api-docs` route serves [`apps/api/config/swagger-output.json`](./apps/api/config/swagger-output.json) if that generated file exists. Run the API package's `swagger` script to regenerate its Swagger output.

## 3. Start-up, scripts, and configuration

Run commands from the repository root unless noted:

```powershell
npm install
npm run db:generate
npm run db:push
npm run dev
```

`npm run dev` starts the API and web development servers concurrently. To run one side:

```powershell
npm run dev:api
npm run dev:web
```

Relevant root scripts:

| Script | Effect |
|---|---|
| `dev` | Starts `dev:api` and `dev:web` concurrently |
| `dev:api` / `dev:web` | Delegates to the API's nodemon script / web's Vite script |
| `db:generate` | Generates Prisma client from `packages/db/prisma/schema.prisma` |
| `db:push` | Pushes the schema to the configured database |
| `db:migrate` | Runs `prisma migrate dev` with the schema path |
| `db` | Runs client generation and schema push concurrently; it is **not** a migration command |
| `db:diff` | Requests a Prisma schema diff script |
| `swagger:api` | Generates API Swagger documentation |
| `socket:api` | Delegates to the API package's `socket` script; confirm that script exists before relying on it |

The web package defines `dev`, `build`, `lint`, and `preview`. The API package defines `dev`, `start`, `swagger`, and `seed`. Neither package defines a test script.

### Environment variables

Set values in the relevant local environment files; never put credential values in this document or commit them.

| Variable | Used for |
|---|---|
| `DATABASE_URL` | Prisma PostgreSQL adapter connection |
| `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT` | Separate `pg` connection initiated by the API database config |
| `JWT_SECRET` | Employee and company JWT signing/verification |
| `FRONTEND_URL` | Express CORS origin and Socket.IO CORS origin |
| `VITE_API_URL` | Web API base URL and Socket.IO server URL |
| `REDIS_URL` | Redis connection URL, if provided |
| `REDIS_HOST`, `REDIS_PORT` | Redis host/port fallback; defaults are `127.0.0.1:6379` |
| `STRIPE_SECRET_KEY` | Stripe SDK |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `NODE_ENV` | Used for the company-auth cookie's `secure` setting |
| ngrok authtoken environment setting | Used by the ngrok package when the API starts its configured forwarder |

Prisma CLI configuration is in [`prisma.config.js`](./prisma.config.js). It loads the repository-root `.env` first and, if `DATABASE_URL` is still unset, falls back to `apps/api/.env`. The Prisma schema and migrations paths are relative to the repository root. The server calls `start()` for its separate PostgreSQL client and starts the HTTP listener on port 8000. It also calls the configured ngrok forwarder. The forwarder targets localhost port 8000 and uses a domain configured in [`apps/api/config/ngrok.js`](./apps/api/config/ngrok.js); it is not controlled by an API `PORT` variable.

## 4. Web application

### App shell, routes, and state

[`apps/web/src/main.jsx`](./apps/web/src/main.jsx) mounts `BrowserRouter`, `AuthProvider`, `WorkspaceProvider`, and the application. [`apps/web/src/App.jsx`](./apps/web/src/App.jsx) declares the routes; [`apps/web/src/components/Layout.jsx`](./apps/web/src/components/Layout.jsx) provides the signed-in shell and role-filtered navigation.

| Browser route | Screen or feature | UI role restriction |
|---|---|---|
| `/` and `/dashboard` | Role-specific dashboard | Any signed-in employee |
| `/home` | Workspace introduction | Any signed-in employee |
| `/leads` | Leads | Admin, Sales, Accounts |
| `/orders` | Sales order view | No route-level role restriction |
| `/inventory` | Inventory | Admin, Warehouse |
| `/requests` | Admin request review or Warehouse request view | Admin or Warehouse |
| `/accounts` | Account overview | Admin, Accounts |
| `/chat` | Admin chat controls or member chat | Any signed-in employee |
| `/team` | Team/user management | Admin |
| `/profile` | Employee profile | Any signed-in employee |
| `/signin`, `/signup` | Employee sign-in and registration | Public |

These are frontend navigation and UX checks, not API authorization. Some API controllers make their own role checks, but they are inconsistent; see [Authorization and implementation gaps](#9-authorization-and-implementation-gaps).

### Employee roles and access (RBAC)

Employee roles are the `ADMIN`, `SALES`, `WAREHOUSE`, and `ACCOUNTS` values in the Prisma `Role` enum. The frontend hides navigation and routes based on role; API authentication and role checks are separate and must be treated as the actual access boundary.

| Role | Intended day-to-day work | Current API/UI access |
|---|---|---|
| **Admin** | Operate the workspace: manage products and leads, review warehouse requests, manage employees and chat rooms, and oversee account data. | Admin-only UI for Team and request review; admin API routes cover catalog, leads, requests, wallet, and chat management. Several routes depend on the flawed `adminMiddleware` described in section 9. |
| **Sales** | Work assigned leads, update lead status, and create/view sales orders. | The API checks the Sales role for lead/order reads and order creation. Updating a lead checks the role but currently does not check assignment ownership. |
| **Warehouse** | Inspect stock and fulfillment orders, submit stock/import requests, and fulfill orders by decrementing inventory. | API handlers check the Warehouse role for most warehouse actions. The stock-read check is broken and does not reliably restrict access. |
| **Accounts** | Review sales activity, order totals, expenses, and account balance. | Accounts endpoints permit Accounts and Admin; the account and balance queries have a schema mismatch noted in section 9. |

The **company account** is a separate authentication identity, not a fifth employee role. Company-authenticated routes manage company members and subscriptions; employee UI routes do not currently expose company onboarding or billing. The current implementation is not a complete or consistently enforced RBAC system: role-based UI visibility is not a security control, and API authorization gaps are listed in section 9.

### Current source layout

```text
apps/web/src/
├── main.jsx, App.jsx, App.css, index.css
├── assets/teamcrm-mark.svg
├── components/
│   ├── Layout.jsx, LogoutButton.jsx, ChatButton.jsx
│   └── ui/ (Navbar.jsx, Footer.jsx)
├── context/
│   ├── AuthContext.jsx
│   ├── WorkspaceContext.jsx
│   └── useWorkspaceUpdates.js
├── features/
│   ├── accounts/accountApi.js
│   ├── admin/adminApi.js, manageRequest.jsx, userManagment.jsx
│   ├── auth/authApi.js, LoginForm.jsx, RegisterForm.jsx
│   ├── chat/adminChatController.jsx, chatApi.js, chatWindow.jsx, messageInput.jsx
│   ├── dashboard/dashBoardApi.js
│   ├── sales/Lead.jsx, SaleOrder.jsx, salesApi.js
│   └── warehouse/ImportInventory.jsx, ImportRequest.jsx, wareHouseApi.js
└── screens/
    ├── Account.jsx, Auth.jsx, Chat.jsx
    └── Dashboard.jsx, Home.jsx, Profile.jsx
```

The feature API modules use Axios and `VITE_API_URL`; requests relying on employee cookies use credentialed requests. `WorkspaceContext` stores UI state for leads, orders, products, and requests, but its arrays are initialized in memory and are not the durable business-data store. Dashboard and feature pages fetch server data. A Socket.IO `workspace_update` event is translated into a browser event so pages can reload their data.

The dashboard selects API calls based on role: Sales loads assigned leads and orders; Warehouse loads orders, inventory, and requests; Admin loads leads, orders, inventory, and requests; Accounts loads sales records. The accounts screen requests sales records and the account balance, but the balance endpoint currently mismatches the schema.

### Employee browser session behavior

Employee login sets an HttpOnly `token` cookie on the API. The login response returns user identity fields but no JWT. The web app stores the user in local storage and stores the literal placeholder `http-only-cookie-session` under a `token` key; it is not a server credential. API authentication uses the cookie or a real Bearer token, not that local-storage placeholder. Initial auth state is restored from local storage without validating the cookie against the server.

## 5. API surface

All paths below are relative to the API origin. The route files are mounted in [`apps/api/src/index.js`](./apps/api/src/index.js). Unless stated otherwise, employee-protected routes use the `token` cookie/Bearer-token `authMiddleware`.

### Employee authentication — `/auth`

| Method and path | Purpose | Route middleware |
|---|---|---|
| `POST /auth/register` | Register an employee | Redis rate limiter |
| `POST /auth/login` | Employee login; sets `token` cookie | Redis rate limiter |
| `POST /auth/logout` | Clear employee cookie | Redis rate limiter |
| `DELETE /auth/delete-user?id=...` | Delete a non-admin user | Employee auth, admin middleware |
| `GET /auth/profile` | Read current employee profile | Employee auth |
| `PUT /auth/profile` | Update current employee profile | Employee auth |
| `GET /auth/get-rooms` | List rooms for current employee | Employee auth |
| `GET /auth/chat/:id/messages` | Load messages for a room | Employee auth; verifies room membership |

### Admin — `/admin`

Admin routes use employee authentication and the admin middleware. The credit endpoint also runs the company balance plan limiter. `adminMiddleware` currently accepts a role from the request body, so these route guards are not safe until that middleware is corrected.

#### Admin — role, responsibilities, and API

An **Admin** is an employee account intended to operate the shared business workspace, not a company login. In the current UI the admin can view the admin dashboard, review stock requests, access leads/inventory/accounts, manage team members, and create/manage team chat rooms. The API additionally provides product and lead management, balance reads, request decisions, and company-wallet crediting. It does not provide a complete company settings or subscription-management interface.

| Method and path | Purpose |
|---|---|
| `POST /admin/product/create-product` | Create catalog product |
| `DELETE /admin/product/delete-product?id=...` | Delete product |
| `PUT /admin/product/update-product/:id` | Update product |
| `POST /admin/lead/create-lead` | Create and assign lead |
| `DELETE /admin/lead/delete-lead?id=...` | Delete lead |
| `GET /admin/lead` | List leads |
| `GET /admin/get-request` | List warehouse stock requests |
| `POST /admin/handle-request?reqId=...` | Intended to approve/debit or reject based on the admin employee's wallet; currently mismatches the company-only Wallet schema |
| `POST /admin/credit-amount?id=<companyId>` | Credit a company's wallet; requires a positive integer `balance` in the body and passes the company's active plan balance limit |
| `GET /admin/balance` | Attempt to read the admin employee's wallet balance; currently mismatches the company-only Wallet schema |
| `GET /admin/get-all-user` | List non-admin employees |
| `POST /admin/room` | Create a chat room and add members |
| `PUT /admin/room` | Add a member to a room |
| `DELETE /admin/room?roomId=...&memberId=...` | Remove a member |
| `DELETE /admin/delete-room` | Delete rooms listed in the request body |

**Admin API notes:** Product creation takes `name`, `price`, and `stock`; lead creation takes `name`, `phone`, and `salesId`. Request review takes `reqId` as a query parameter and is intended to approve/debit or reject based on available funds, but the current schema has no employee wallet for the handler to query. The credit endpoint now has employee auth/admin middleware, but its handler is specifically for a **company** wallet (`id` query parameter and `{ "balance": ... }` body), not the admin employee's personal wallet. The current web helper submits `{ amount }` without the company ID, so the credit form is not wired to the endpoint's current contract.

### Sales — `/sales`

All routes have employee authentication; the sales controller checks for the `SALES` role on the sales lead/order reads and order creation.

| Method and path | Purpose |
|---|---|
| `GET /sales/leads` | List leads assigned to the signed-in sales user |
| `GET /sales/orders` | List orders belonging to the signed-in sales user |
| `POST /sales/create-order` | Create an order from a lead and product line items |
| `PUT /sales/lead?id=...` | Update a lead's status |

### Warehouse — `/warehouse`

All routes have employee authentication. There is no router-level warehouse/admin role middleware; individual controller checks vary.

| Method and path | Purpose |
|---|---|
| `GET /warehouse/get-stock-data` | Read product stock |
| `GET /warehouse/get-order-list` | Read orders for fulfillment |
| `POST /warehouse/export-order/:id` | Decrement inventory and process an order |
| `GET /warehouse/get-req-list` | Read stock requests |
| `POST /warehouse/import-stock` | Submit a stock/import request |

### Accounts — `/accounts`

Both routes have employee authentication. The controller permits Accounts and Admin roles.

| Method and path | Purpose |
|---|---|
| `GET /accounts/get-balance` | Attempt to read the employee wallet balance; currently mismatches the company-only Wallet schema |
| `GET /accounts/sales-list` | Read sales users, expenses, leads, and their orders |

### Company, plans, and payments

| Method and path | Purpose | Route middleware |
|---|---|---|
| `POST /company/register` | Register company and create its initial active subscription on a Free plan | None |
| `POST /company/login` | Company login; sets `companyToken` cookie | None |
| `POST /company/logout` | Company logout handler | None |
| `POST /company/create-member` | Create an employee linked to the authenticated company | Company auth, company lookup, member plan limit |
| `POST /company/add-member?id=...` | Connect an existing employee to the authenticated company | Company auth, company lookup, member plan limit |
| `GET /company/subscription` | List subscriptions for the authenticated company | Company auth, company lookup |
| `POST /company/subscription` | Create an active subscription using the submitted `planId` | Company auth |
| `GET /plans` | List active plans with plan details | Company authentication and company lookup |
| `POST /plans` | Create a plan with details/limits | **No authentication is attached** |
| `POST /payment/make-payment` | Create a pending payment and Stripe PaymentIntent for a paid plan | Company authentication and company lookup |
| `POST /payment/webhook` | Process Stripe PaymentIntent events | Raw JSON body is registered before `express.json()`; Stripe signature is verified |

On `payment_intent.succeeded`, the webhook validates the local payment and plan, marks the payment successful, cancels existing company subscriptions, creates a new 30-day subscription, and updates the company's current `planId`. On `payment_intent.payment_failed`, it marks the matching pending payment as failed. Other event types receive an empty successful response.

Plan limits are implemented in [`apps/api/jobs/planLimiter.js`](./apps/api/jobs/planLimiter.js). It looks for a company ID in `req.company.id` or `req.query.id`, finds the company's active non-expired subscription, loads its plan details, and checks member, order, or balance usage. It is mounted on company member creation/addition, sales order creation, and admin crediting. The company member routes have company auth/context; the credit route uses the `id` query parameter. The sales order route has employee auth but provides neither company context nor that query parameter, so order creation currently fails at the limiter before the controller runs. The limiter compares the company wallet's numeric balance plus requested amount against the plan's `Details.balance` limit. Separately, plan creation still submits `maxWallet`, which does not match that schema field. Subscription expiration code is scheduled separately; see [Background jobs and real-time behavior](#7-background-jobs-and-real-time-behavior).

## 6. Database model

The source of truth is [`packages/db/prisma/schema.prisma`](./packages/db/prisma/schema.prisma). The schema configures PostgreSQL and a Prisma client generator. Enum values and models currently defined are:

### Enums

| Enum | Values |
|---|---|
| `Role` | `ADMIN`, `WAREHOUSE`, `ACCOUNTS`, `SALES` |
| `leadStatus` | `DECLINED`, `COMPLETED`, `PENDING` |
| `orderStatus` | `PLACED`, `DELIVERED`, `PROCESS` |
| `reqStatus` | `REQUESTED`, `REJECTED`, `APPROVED` |
| `paymentStatus` | `PENDING`, `SUCCESS`, `FAIL` |
| `planType` | `FREE`, `PRO` |
| `subscriptionStatus` | `ACTIVE`, `CANCEL`, `EXPIRE`, `INACTIVE` |

### Models and relationships

| Model | Stored data and relationships |
|---|---|
| `User` | Auto-increment integer ID, name, unique email, password hash, role, optional `memberOf` company ID; relations to leads, orders, expenses, requests, messages, and chat memberships. `memberOf` is not unique. There is no User-to-Wallet relation in the current schema. |
| `Company` | UUID ID, name, unique email, password hash, members, orders, optional wallet, required current `planId`, subscriptions, and payments. |
| `Lead` | UUID ID, name, unique 10-character phone, status defaulting to `PENDING`, required sales-user assignment, and orders. |
| `Product` | UUID ID, name, integer price defaulting to zero, stock quantity, order items, and optional request relation. |
| `Order` | UUID ID, status defaulting to `PLACED`, decimal total, creation timestamp, required sales user, required lead, order items, and required company `orderOf`. |
| `OrderItem` | UUID ID, quantity defaulting to one, integer price, required order and product relations. |
| `Expenses` | String ID, integer amount, optional note, and required user relation. |
| `Wallet` | Auto-increment ID, integer balance defaulting to zero, unique company `balanceOf`, and a required relation to Company. The schema does not define a user wallet or a `userId` field. |
| `Request` | Auto-increment ID, integer amount, optional note, status defaulting to `REQUESTED`, required user, and related products. |
| `Room` | UUID ID, name, creation timestamp, messages, and group memberships. |
| `GroupMember` | UUID ID, room/user IDs, `isAdmin` default false, `joinedAt`, cascade-delete relations, and unique `(roomId, userId)`. |
| `Message` | UUID ID, text, creation timestamp, user and room relations; deleting its user or room cascades to messages. |
| `Payment` | CUID ID, integer amount, currency defaulting to `usd`, status defaulting to `PENDING`, optional Stripe intent ID, creation time, optional company and plan relations; index on company, plan, and creation time. |
| `Plan` | UUID ID, unique name, integer price, active flag, type defaulting to `FREE`, optional one-to-one details, companies, subscriptions, payments, creation time; index on creation time and ID. |
| `Details` | UUID ID, integer `maxMember` and `maxOrder`, integer `balance` defaulting to zero, unique plan ID and plan relation. |
| `Subscription` | UUID ID, status defaulting to `ACTIVE`, company and plan IDs, creation/start timestamps, optional cancellation/end timestamps, auto-updated timestamp; index on company and plan. |

The company has a current plan pointer (`Company.planId`) in addition to subscription history. Subscription status belongs to `Subscription`, not `Plan`. Company routes can create a company-linked employee or connect an existing employee by ID; there is no invitation/token-based join flow.

## 7. Background jobs and real-time behavior

### Socket.IO events

[`apps/api/config/socket.js`](./apps/api/config/socket.js) creates a Socket.IO server on the HTTP server and restricts its CORS origin to `FRONTEND_URL`. The socket handshake authenticates the employee `token` cookie, reloads the employee from the database, and rejects accounts without a `memberOf` company association. Company tokens are not accepted by this socket middleware.

| Event | Behavior |
|---|---|
| `join_room` | Verifies the employee belongs to the room, joins the socket room, returns messages, and emits `receipts_sync` |
| `send_message` | Validates membership and non-empty text, puts the message in Redis, broadcasts `receive_message`, acknowledges the sender |
| `mark_message_seen` | Verifies membership and message existence/order, updates the in-memory receipt, broadcasts `receipts_updated` |
| `workspace_update` | Server-wide invalidation signal emitted after selected business writes; web clients dispatch a browser event and reload data |
| `room_error` | Sent to a client for a room-membership/read-receipt error |
| `meeting:create`, `meeting:join`, `meeting:leave` | Creates or joins a company-scoped meeting; participant presence and WebRTC offer/answer/ICE relay are handled over Socket.IO |

Chat message history is stored in PostgreSQL. Read receipts are held in a process-local Map by [`apps/api/config/readReceipts.js`](./apps/api/config/readReceipts.js), not in the database; they are lost when the process restarts. Message persistence uses Redis lists `crm:message:buffer` and `crm:message:processing`. [`apps/api/config/worker.js`](./apps/api/config/worker.js) flushes up to 250 queued messages to Prisma once per minute using `createMany` with duplicate skipping.

#### Meeting functionality and limitations

The web app provides a meeting lobby and room at `/meetings` and `/meetings/:meetingId`. The lobby creates meetings through `meeting:create` or accepts an ID/link; the room joins through `meeting:join`, acquires local camera/microphone access, and uses WebRTC peer connections with Socket.IO offer/answer/ICE signaling. The server requires an authenticated employee with a company association and only permits joining meetings owned by that company. `meeting:leave` and socket disconnect remove participants; empty meetings are deleted.

Meeting records in [`apps/api/config/meetManager.js`](./apps/api/config/meetManager.js) are process-local. They are lost on API restart and are not shared across API instances, so this implementation requires a single API process and is not durable or horizontally scalable. The web client currently uses a public STUN server but no TURN relay; peer-to-peer media can fail on restrictive NATs or firewalls. Production deployment needs shared meeting state and Socket.IO coordination across instances, plus a TURN service and appropriate credential/configuration management.

The Swagger generator now includes employee, admin, warehouse, sales, company, plan, and payment route files. It documents HTTP routes only; Socket.IO events are not represented in the generated OpenAPI document. The payment webhook is registered directly in the API entry point before JSON parsing.

### Subscription expiration

[`apps/api/jobs/expireSubscriptionHandler.js`](./apps/api/jobs/expireSubscriptionHandler.js) schedules a scan every five minutes for active subscriptions whose `endAt` has passed. The handler attempts to mark expired subscriptions and restore the company's Free plan. This scheduled job runs when the API module is imported; it is not a separate worker process.

## 8. Intended workflows and current completion

1. **Workspace onboarding:** A company can register and receives an active Free subscription if an active Free plan already exists. Company login is separate from employee login. No company sign-in, plan-selection, or billing screen is wired into the current web route tree.
2. **Employee onboarding:** The public employee registration endpoint accepts a role in the request body; the web form offers Sales, Warehouse, or Accounts, but not Admin. Company-authenticated routes also allow creating a member with a shared fixed password or connecting an existing employee by ID, subject to the member limiter.
3. **Sales:** Admins can create and assign leads. A sales user can view leads assigned to them, update a lead status, and create orders using product IDs and quantities.
4. **Warehouse:** Warehouse users can view orders and stock, submit stock requests, and process an order when product stock is sufficient. The handler decrements stock and updates order status.
5. **Request review:** Admins can view requests; the handler intends to compare the amount to the acting admin's wallet, then approve/debit or reject the request. This flow does not match the current company-only Wallet schema and is expected to fail until the wallet model or handler is aligned.
6. **Accounts:** Accounts/Admin users can request a balance and nested sales records, including leads, orders, and expenses. The sales-list query is implemented; the balance query expects a user-wallet field that the current schema does not have, so it is not a working end-to-end account balance feature.
7. **Chat:** An admin can create rooms and manage membership. Room members can retrieve messages and use Socket.IO messaging/read receipts.
8. **Subscriptions:** Company creation assigns an active Free plan subscription; a company-authenticated payment request initializes a Stripe PaymentIntent for an active paid Pro plan. The webhook records payment outcome and creates the paid subscription. A separate company `POST /subscription` endpoint can directly create an active subscription for a supplied plan ID, without payment. There is no company onboarding, plan-selection, or billing UI.

The API and UI do not yet provide every end-to-end workflow. Subscriptions and payments have no current UI, and business controllers do not consistently populate all required database fields.

## 9. Authorization and implementation gaps

These notes describe observed code behavior and should be revisited as fixes land.

- **Admin middleware trusts request data:** `adminMiddleware` evaluates `req.body.role || req.user.role`. A caller can supply `role: "ADMIN"` in the body instead of the role in the verified token. Admin authorization must use the authenticated identity only.
- **Public role selection:** Employee registration is unauthenticated and accepts the role from the request body. Omitting Admin from the dropdown is only a UI restriction.
- **Employee company association:** `User.memberOf` is optional in the current schema, so public employee registration can create an employee without a company. Company `create-member` uses the fixed password `techbuilds`; `add-member` accepts an existing user ID and has no invitation or ownership-verification flow for users already associated with another company.
- **Profile password update:** The employee profile controller writes a supplied password directly rather than hashing it, unlike account creation/login.
- **Order/company mismatch:** `Order.orderOf` is required by Prisma, but the sales order controller does not set it. It may fail to create an order. The order route's `planLimiter("order")` also runs before the controller and receives neither `req.company` nor a company query ID from the sales UI, so it rejects the request with a company-authentication error.
- **Wallet schema mismatch:** `Wallet` only relates to Company via `balanceOf`; it has no `userId`. The request approval and account-balance controllers query `wallet.userId`, so those intended employee-wallet flows do not match the generated Prisma model. Company wallet crediting in the admin controller does use `balanceOf`.
- **Warehouse stock read authorization:** The stock handler's condition uses `role !== "ADMIN" || role !== "WAREHOUSE"`, which is always true for a single role; its subsequent negation therefore does not block unauthorized roles. Other warehouse handlers have their own and inconsistent checks.
- **Lead status ownership:** The sales status-update handler checks the caller's Sales role but fetches/updates by lead ID without verifying that the lead is assigned to that user. The read and create-order paths do enforce assignment.
- **Role checks are uneven:** The route guards in the web app are not security controls. Warehouse checks happen in individual handlers; Accounts controllers check Accounts/Admin; Sales checks are limited to selected handlers and status updates do not confirm lead ownership. Most admin routes apply the flawed admin middleware. The credit route now includes auth/admin middleware.
- **Plan creation and subscription changes:** `POST /plans` has no authentication middleware. Company `POST /subscription` checks that the company and plan exist and that plan details exist, but does not check whether the plan is active, update `Company.planId`, or require payment. The plan controller accepts/creates `maxWallet`, while the current `Details` schema has `balance`, so plan creation does not match the schema.
- **Plan limiter wiring:** `planLimiter` is mounted for company member routes, sales order creation, and admin crediting. The member routes have verified company context, and the admin credit route can use its query `id`; sales order creation has no company ID/context and is blocked. The balance limit comparison itself uses the current numeric wallet balance correctly, but plan creation's field mismatch means plan details may not be created as intended.
- **Admin wallet UI/API mismatch:** The admin controller expects `POST /admin/credit-amount?id=<companyId>` with `{ "balance": <positive integer> }` and credits a company wallet. The web UI helper sends `{ "amount": ... }` and no company ID; it also describes the target as the admin wallet. The UI flow therefore cannot successfully call the current endpoint.
- **Meeting events are incomplete:** The new socket meeting handlers do not currently provide a usable meeting lifecycle, and no browser feature calls them. See [Meeting prototype status](#meeting-prototype-status).
- **Company logout cookie name:** Company login sets `companyToken`, while the company logout handler clears `token`; this may leave the company cookie present.
- **Employee session state:** The browser stores a placeholder token string in local storage and restores the user without checking the cookie/session with the API. Server auth is cookie-based, so stale browser identity and expired cookies can disagree.
- **Company isolation is incomplete:** Several employee business queries are global and not consistently filtered by `memberOf`/company ID. Treat this as a single shared dataset, not as proven tenant isolation.
- **Schema/setup:** The Prisma schema uses the PostgreSQL adapter and expects `DATABASE_URL`; [`prisma.config.js`](./prisma.config.js) loads it from the root `.env`, falling back to `apps/api/.env`. API startup also opens a separate `pg` connection using `DB_*` values. Configure both sets consistently.
- **Operations/testing:** No package test script is configured. The repository has no discovered `*.test.*` or `*.spec.*` files. Validate critical role, ownership, tenant-isolation, and payment behavior before production use.

## 10. Useful implementation links

### API entry, middleware, and services

- API startup and route mounting: [`apps/api/src/index.js`](./apps/api/src/index.js)
- Employee and company routes: [`apps/api/routes/userRoutes.js`](./apps/api/routes/userRoutes.js), [`apps/api/routes/companyRoutes/companyRoute.js`](./apps/api/routes/companyRoutes/companyRoute.js)
- Admin, sales, warehouse, accounts, payment, and plans routes: [`apps/api/routes/adminRoutes/adminRoutes.js`](./apps/api/routes/adminRoutes/adminRoutes.js), [`apps/api/routes/saleRoute.js`](./apps/api/routes/saleRoute.js), [`apps/api/routes/warehouseRoute.js`](./apps/api/routes/warehouseRoute.js), [`apps/api/routes/accountRoute.js`](./apps/api/routes/accountRoute.js), [`apps/api/routes/paymentRoute.js`](./apps/api/routes/paymentRoute.js), [`apps/api/routes/planRoute.js`](./apps/api/routes/planRoute.js)
- Employee authentication and authorization middleware: [`apps/api/middleware/authMiddleware.js`](./apps/api/middleware/authMiddleware.js), [`apps/api/middleware/adminMiddleware.js`](./apps/api/middleware/adminMiddleware.js)
- Company authentication middleware: [`apps/api/middleware/companyAuthMiddleware.js`](./apps/api/middleware/companyAuthMiddleware.js), [`apps/api/middleware/company.js`](./apps/api/middleware/company.js)
- Company member/subscription operations and plan limits: [`apps/api/controller/company/companyAuth.js`](./apps/api/controller/company/companyAuth.js), [`apps/api/jobs/planLimiter.js`](./apps/api/jobs/planLimiter.js)
- Business controllers: [`apps/api/controller/userController.js`](./apps/api/controller/userController.js), [`apps/api/controller/adminController/adminController.js`](./apps/api/controller/adminController/adminController.js), [`apps/api/controller/saleController.js`](./apps/api/controller/saleController.js), [`apps/api/controller/warehouseController.js`](./apps/api/controller/warehouseController.js), [`apps/api/controller/accountsController.js`](./apps/api/controller/accountsController.js)
- Company and plan controllers: [`apps/api/controller/company/companyAuth.js`](./apps/api/controller/company/companyAuth.js), [`apps/api/controller/planController.js`](./apps/api/controller/planController.js)
- Payments and Stripe setup: [`apps/api/controller/paymentController.js`](./apps/api/controller/paymentController.js), [`apps/api/config/stripe.js`](./apps/api/config/stripe.js)
- Prisma and Redis clients: [`apps/api/config/prismaClient.js`](./apps/api/config/prismaClient.js), [`apps/api/config/redis.js`](./apps/api/config/redis.js)
- Socket, chat, queue worker, and subscription job: [`apps/api/config/socket.js`](./apps/api/config/socket.js), [`apps/api/config/chatHandler.js`](./apps/api/config/chatHandler.js), [`apps/api/config/worker.js`](./apps/api/config/worker.js), [`apps/api/jobs/expireSubscriptionHandler.js`](./apps/api/jobs/expireSubscriptionHandler.js)

### Web and database

- Browser routes and app providers: [`apps/web/src/App.jsx`](./apps/web/src/App.jsx), [`apps/web/src/main.jsx`](./apps/web/src/main.jsx)
- Auth and workspace state: [`apps/web/src/context/AuthContext.jsx`](./apps/web/src/context/AuthContext.jsx), [`apps/web/src/context/WorkspaceContext.jsx`](./apps/web/src/context/WorkspaceContext.jsx)
- Dashboard and account pages: [`apps/web/src/screens/Dashboard.jsx`](./apps/web/src/screens/Dashboard.jsx), [`apps/web/src/screens/Account.jsx`](./apps/web/src/screens/Account.jsx)
- Web feature modules: [`apps/web/src/features/`](./apps/web/src/features/)
- Database models and enums: [`packages/db/prisma/schema.prisma`](./packages/db/prisma/schema.prisma)
- Prisma CLI configuration: [`prisma.config.js`](./prisma.config.js)
- Root and package scripts: [`package.json`](./package.json), [`apps/api/package.json`](./apps/api/package.json), [`apps/web/package.json`](./apps/web/package.json), [`packages/db/package.json`](./packages/db/package.json)