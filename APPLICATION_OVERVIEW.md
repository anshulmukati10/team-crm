# Team CRM — Application Overview

## Purpose

Team CRM is an internal workspace for coordinating sales leads, customer orders, product inventory, stock replenishment, account activity, and team chat. Its intended workflow connects sales, warehouse, accounts, and administration from lead assignment through order fulfillment.

This document describes both the intended product behavior and the implementation currently present in the repository. Where those differ, the difference is called out explicitly.

## Application architecture

The repository is a JavaScript monorepo:

| Area | Location | Responsibility |
|---|---|---|
| Web client | [`apps/web/`](./apps/web/) | React single-page application built with Vite |
| API | [`apps/api/`](./apps/api/) | Express REST API, authentication, business logic, and Socket.IO setup |
| Database package | [`packages/db/`](./packages/db/) | Prisma schema and migrations |
| Shared UI package | [`packages/ui/`](./packages/ui/) | Shared UI package (currently minimal) |

The API mounts routes under `/auth`, `/admin`, `/warehouse`, `/sales`, and `/accounts`. It uses Prisma with PostgreSQL, JWT-based authentication, cookies, and Socket.IO for chat. The frontend uses React Router, Axios, and `socket.io-client`.

### Main data concepts

The Prisma schema in [`packages/db/prisma/schema.prisma`](./packages/db/prisma/schema.prisma) defines:

- **User** — a person with one of the roles listed below.
- **Lead** — a customer prospect assigned to a sales user, with a pending/completed/declined status.
- **Product** — catalog item with price and stock quantity.
- **Order and OrderItem** — a sales order linked to a lead and sales user, with product quantities and prices.
- **Request** — a warehouse stock/import request with amount, note, status, and associated products.
- **Wallet and Expenses** — account balance and recorded amounts associated with users.
- **Room, GroupMember, and Message** — group chat rooms, membership, and messages.

## Roles and intended permissions

The database role enum is `ADMIN`, `SALES`, `WAREHOUSE`, and `ACCOUNTS`. These are the intended responsibility boundaries:

| Role | Intended permissions |
|---|---|
| **Admin** | Manage products; create, view, assign, and delete leads; view users; review warehouse requests and approve/reject them; credit balances; create chat rooms and manage room membership; administer users. |
| **Sales** | Work assigned leads and create orders for those leads using catalog products. Sales users should not be able to create orders on behalf of another sales user or access another user's leads. |
| **Warehouse** | View inventory and order queues; fulfill orders when stock is available; submit and review stock replenishment requests. |
| **Accounts** | Review account balance and sales-related records, including sales users, leads, orders, and expenses. |

### Shared capabilities

- Any signed-in user can view and update their own profile.
- A chat member can load messages for a room they belong to.
- Users can register and sign in. The current registration form offers Sales, Warehouse, and Accounts, but not Admin.

### Current authorization status — read before relying on RBAC

The table above is the **intended** access model, not a guarantee that every permission is correctly enforced today. Authorization checks are inconsistent across API routes:

- Admin routes use `adminMiddleware`, but that middleware checks `req.body.role` before the authenticated `req.user.role`. The request body must not be treated as a trusted source of role; this makes the current admin gate unsafe.
- Registration is public, and role restrictions exist only in the frontend form. The API accepts the submitted role, so hiding Admin in the form is not sufficient to prevent privileged role assignment.
- The sales order endpoint now checks that the signed-in user is Sales, verifies that the lead is assigned to that user, and derives the order's sales ID from the authenticated identity.
- Warehouse handlers do not all have consistent role enforcement. In particular, the stock-data authorization condition does not correctly restrict access.
- Accounts endpoints check for Accounts/Admin in their controllers. Keep these checks covered by tests as the handlers evolve.
- The frontend filters navigation by role and guards selected routes; other routes are shared. These checks only control the user interface. The API must independently authorize every request.
- Login sets an HttpOnly cookie, while the frontend auth context also stores a placeholder session marker in local storage. The cookie is the credential sent with API requests; the marker is not a server-validated token. Ensure session restoration, logout, and expired-cookie behavior stay consistent.

Before production use, enforce roles and resource ownership on the server for every protected operation, prevent public self-assignment of privileged roles, and test each role against both allowed and denied actions. See the API route files and controller files linked under [Related implementation](#related-implementation).

## Main workflows

1. An administrator creates products and creates leads assigned to sales users.
2. A sales user creates an order for an eligible lead and selects product quantities.
3. Warehouse staff review orders, check stock, and fulfill orders.
4. Warehouse staff submit replenishment requests when inventory is insufficient.
5. An administrator reviews a replenishment request and approves or rejects it based on available funds.
6. Accounts staff review balance and sales-related financial activity.
7. An administrator creates chat rooms and adds team members; room members communicate in chat.

The API contains operations for these workflows, but some screens and authorization checks are incomplete. Treat the steps as the intended product flow, not proof that every workflow is complete end-to-end in the UI.

## Frontend

### Current frontend structure

The existing frontend is in [`apps/web/src/`](./apps/web/src/):

```text
src/
├── main.jsx
├── App.jsx
├── App.css
├── index.css
├── assets/
│   └── teamcrm-mark.svg
├── components/
│   ├── Layout.jsx
│   ├── LogoutButton.jsx
│   ├── ChatButton.jsx
│   └── ui/
│       ├── Footer.jsx
│       └── Navbar.jsx
├── context/
│   ├── AuthContext.jsx
│   ├── WorkspaceContext.jsx
│   └── useWorkspaceUpdates.js
├── features/
│   ├── accounts/
│   │   └── accountApi.js
│   ├── admin/
│   │   ├── adminApi.js
│   │   ├── manageRequest.jsx
│   │   └── userManagment.jsx
│   ├── dashboard/
│   │   └── dashBoardApi.js
│   ├── auth/
│   │   ├── authApi.js
│   │   ├── LoginForm.jsx
│   │   └── RegisterForm.jsx
│   ├── chat/
│   │   ├── adminChatController.jsx
│   │   ├── chatApi.js
│   │   ├── chatWindow.jsx
│   │   └── messageInput.jsx
│   ├── sales/
│   │   ├── Lead.jsx
│   │   ├── SaleOrder.jsx
│   │   └── salesApi.js
│   └── warehouse/
│       ├── ImportInventory.jsx
│       ├── ImportRequest.jsx
│       └── wareHouseApi.js
└── screens/
    ├── Account.jsx
    ├── Auth.jsx
    ├── Chat.jsx
    ├── Dashboard.jsx
    ├── Home.jsx
    └── Profile.jsx
```

The route definitions and selected route-level role checks are in [`apps/web/src/App.jsx`](./apps/web/src/App.jsx). The application shell and role-filtered navigation are in [`apps/web/src/components/Layout.jsx`](./apps/web/src/components/Layout.jsx). Shared identity and role state are provided by `AuthContext` and `WorkspaceContext`; workspace update events are handled by `useWorkspaceUpdates.js`. The Dashboard loads different summary data by role. Sign-in and registration are available at `/signin` and `/signup`.

The project scripts are `dev`, `build`, `lint`, and `preview`; there is no frontend test script in [`apps/web/package.json`](./apps/web/package.json). Existing feature folders are a useful foundation, but some workspace state is in-memory-only; use the backend as the source of truth for business data.

### Recommended frontend structure

Keep the current feature-oriented approach, but make routing, shared API configuration, role-aware navigation, and tests explicit as the app grows. This is a **recommended target structure**, not a claim that all folders already exist:

```text
apps/web/src/
├── app/
│   ├── App.jsx                 # Providers and application route tree
│   └── router.jsx              # Route definitions and route-level guards
├── assets/                     # Imported images, fonts, and static UI assets
├── components/
│   ├── layout/                 # App shell, navigation, footer, page containers
│   └── ui/                     # Reusable buttons, inputs, tables, dialogs, alerts
├── features/
│   ├── auth/                   # Login, registration, profile, auth API and forms
│   ├── admin/                  # User, product, lead, request, and chat administration
│   ├── dashboard/              # Role-specific overview data and summary widgets
│   ├── sales/                  # Lead views and order creation
│   ├── warehouse/              # Inventory, order fulfillment, import requests
│   ├── accounts/               # Balance and sales/expense reporting
│   └── chat/                   # Rooms, membership UI, messages, socket behavior
├── context/                    # Small app-wide auth/session or workspace state
├── hooks/                      # Reusable React hooks not owned by one feature
├── lib/
│   ├── apiClient.js            # Shared Axios instance, credentials, base URL
│   └── errors.js               # Shared API error handling helpers
├── screens/                    # Route-level pages composed from feature components
├── utils/                      # Pure formatting, validation, and data helpers
├── constants/                  # Shared role names, route paths, and UI constants
├── styles/                     # Global styles and shared design tokens, if needed
└── test/                       # Shared test setup and frontend test utilities
```

### What belongs in each frontend area

- **`app/` and routing:** Compose global providers and declare routes in one place. Add an authentication guard for signed-in pages and a role guard for role-specific pages. Guards improve navigation and UX; the API must still authorize every request.
- **`screens/`:** One component per route/page. Keep these components focused on page layout and composing feature components rather than embedding API/business logic.
- **`features/<domain>/`:** Keep domain-specific forms, tables, components, API functions, and hooks together. For example, `features/warehouse/` owns stock lists and request forms; `features/accounts/` owns balance and reporting views.
- **`components/ui/`:** Reusable presentational building blocks with no domain-specific permissions or API calls. Keep application shell pieces under `components/layout/`.
- **`context/`:** Only cross-application state that multiple routes need, such as the signed-in user's identity and lightweight workspace events. Avoid treating duplicated server data as authoritative or storing credentials in browser storage.
- **`lib/apiClient.js`:** Centralize the API base URL, cookie/credential configuration, and common request setup so feature API modules do not each configure Axios differently.
- **`hooks/`:** Reusable stateful behavior shared by multiple features. Domain-specific hooks should stay inside their feature folder.
- **`utils/` and `constants/`:** Pure reusable helpers and shared names (especially role and route constants); do not use these as catch-all folders for business logic.
- **`test/`:** Shared test setup. Put feature behavior tests close to the feature where practical, and cover both permitted and denied role behavior.
- **`assets/` and `styles/`:** Imported assets and global styling. Keep route- or component-specific styles near their owner when that is clearer.

### Frontend implementation guidelines

1. Use feature API modules for domain requests and screens for page composition.
2. Keep role checks centralized and use the same role names as the API/database enum.
3. Show navigation and actions appropriate to the user's role, but never rely on UI hiding for security.
4. Represent loading, empty, success, and error states for every asynchronous view.
5. Keep authentication/session state consistent with the API's HttpOnly cookie behavior; do not assume a browser-readable token is available.
6. Add tests for route access, role-specific UI, and critical workflows as those areas are implemented.

## API surface (high-level)

| Prefix | Main responsibilities |
|---|---|
| `/auth` | Register, login, logout, profile, and room-message retrieval |
| `/admin` | Product and lead management, user listing/deletion, stock-request review, account credits, chat-room management |
| `/sales` | Create sales orders |
| `/warehouse` | Read stock/order data, fulfill orders, and submit/read stock-import requests |
| `/accounts` | Read balance and sales-related records |

Exact routes and middleware are defined in [`apps/api/routes/`](./apps/api/routes/). The warehouse route group also has a rate limiter. Chat uses Socket.IO in addition to the message-retrieval endpoint.

## Related implementation

- Database entities and roles: [`packages/db/prisma/schema.prisma`](./packages/db/prisma/schema.prisma)
- API route registration and middleware: [`apps/api/src/index.js`](./apps/api/src/index.js)
- Authentication and profile operations: [`apps/api/controller/userController.js`](./apps/api/controller/userController.js)
- Authentication middleware: [`apps/api/middleware/authMiddleware.js`](./apps/api/middleware/authMiddleware.js)
- Admin role middleware: [`apps/api/middleware/adminMiddleware.js`](./apps/api/middleware/adminMiddleware.js)
- Admin operations: [`apps/api/controller/adminController/adminController.js`](./apps/api/controller/adminController/adminController.js)
- Sales operations: [`apps/api/controller/saleController.js`](./apps/api/controller/saleController.js)
- Warehouse operations: [`apps/api/controller/warehouseController.js`](./apps/api/controller/warehouseController.js)
- Accounts operations: [`apps/api/controller/accountsController.js`](./apps/api/controller/accountsController.js)
- Frontend entry and routes: [`apps/web/src/App.jsx`](./apps/web/src/App.jsx)
- Frontend auth state: [`apps/web/src/context/AuthContext.jsx`](./apps/web/src/context/AuthContext.jsx)
