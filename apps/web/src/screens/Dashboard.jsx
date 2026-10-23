import { useEffect, useMemo, useState } from "react";
import {
  DataTable,
  formatCurrency,
  Icon,
  MetricCard,
  PageHeading,
  StatusBadge,
} from "../components/ui/Navbar";
import { useAuth } from "../context/WorkspaceContext";
import { getDashboardData } from "../features/dashboard/dashBoardApi";
import useWorkspaceUpdates from "../context/useWorkspaceUpdates";

function isOpenOrder(status) {
  return ["PLACED", "PROCESS", "PENDING", "PROCESSING"].includes(
    String(status).toUpperCase(),
  );
}

function isLowStock(product) {
  return Number(product.stock) <= 10;
}

function formatStatus(status) {
  const value = String(status || "");
  const orderStatusLabels = {
    DELIVERED: "Fulfilled",
    PLACED: "Pending",
    PROCESS: "Processing",
  };
  if (orderStatusLabels[value.toUpperCase()]) {
    return orderStatusLabels[value.toUpperCase()];
  }
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function getAccountOrders(sales) {
  return sales
    .flatMap((representative) =>
      (representative.leads || []).flatMap((lead) =>
        (lead.orders || []).map((order) => ({
          ...order,
          customer: lead.name,
          salesRepresentative: representative.name,
        })),
      ),
    )
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
}

export default function Dashboard() {
  const { role, user } = useAuth();
  const workspaceVersion = useWorkspaceUpdates();
  const [loadState, setLoadState] = useState({
    role: null,
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    getDashboardData(role)
      .then((result) => {
        if (active) {
          setLoadState({ role, status: "success", data: result });
        }
      })
      .catch((loadError) => {
        if (active) {
          setLoadState({
            role,
            status: "error",
            error: loadError.message || "Unable to load dashboard data.",
          });
        }
      })

    return () => {
      active = false;
    };
  }, [role, workspaceVersion]);

  const loading = loadState.role !== role || loadState.status === "loading";
  const data =
    loadState.status === "success" && loadState.role === role
      ? loadState.data
      : null;
  const error =
    loadState.status === "error" && loadState.role === role
      ? loadState.error
      : "";
  const accountOrders = useMemo(
    () => getAccountOrders(data?.sales || []),
    [data],
  );
  const orders =
    role === "ACCOUNTS" ? accountOrders : data?.orders || [];
  const lowStock = (data?.products || []).filter(isLowStock);
  const openOrders = orders.filter((order) => isOpenOrder(order.status));
  const pendingRequests = (data?.requests || []).filter(
    (request) =>
      ["REQUESTED", "PENDING"].includes(String(request.status).toUpperCase()),
  );
  const orderValue = orders.reduce(
    (total, order) => total + Number(order.total || 0),
    0,
  );

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const descriptions = {
    ADMIN: "A live overview of leads, orders, stock, and requests.",
    SALES: "Your sales workspace overview.",
    WAREHOUSE: "A live overview of orders, inventory, and stock requests.",
    ACCOUNTS: "A live overview of sales activity and order values.",
  };

  const accountMetrics = [
    {
      icon: "users",
      label: "Sales representatives",
      note: "Sales team members",
      tone: "purple",
      value: String(data?.sales?.length || 0),
    },
    {
      icon: "box",
      label: "Total orders",
      note: "Across the sales team",
      tone: "blue",
      value: String(orders.length),
    },
    {
      icon: "clock",
      label: "Open orders",
      note: "Not yet delivered",
      tone: "orange",
      value: String(openOrders.length),
    },
    {
      icon: "chart",
      label: "Order value",
      note: "All recorded orders",
      tone: "green",
      value: formatCurrency(orderValue),
    },
  ];

  const adminMetrics = [
    {
      icon: "users",
      label: "Leads",
      note: "Recorded in the CRM",
      tone: "purple",
      value: String(data?.leads?.length || 0),
    },
    {
      icon: "box",
      label: "Orders to fulfill",
      note: "Open orders",
      tone: "orange",
      value: String(openOrders.length),
    },
    {
      icon: "package",
      label: "Low stock items",
      note: "10 units or fewer",
      tone: "green",
      value: String(lowStock.length),
    },
    {
      icon: "clock",
      label: "Stock requests",
      note: "Awaiting review",
      tone: "blue",
      value: String(pendingRequests.length),
    },
  ];

  const warehouseMetrics = [
    {
      icon: "box",
      label: "Orders to fulfill",
      note: "Open orders",
      tone: "orange",
      value: String(openOrders.length),
    },
    {
      icon: "package",
      label: "Catalog products",
      note: "Recorded in inventory",
      tone: "blue",
      value: String(data?.products?.length || 0),
    },
    {
      icon: "chart",
      label: "Low stock items",
      note: "10 units or fewer",
      tone: "green",
      value: String(lowStock.length),
    },
    {
      icon: "clock",
      label: "Stock requests",
      note: "Awaiting review",
      tone: "purple",
      value: String(pendingRequests.length),
    },
  ];
  const salesMetrics = [
    {
      icon: "users",
      label: "Assigned leads",
      note: "Leads assigned to you",
      tone: "purple",
      value: String(data?.leads?.length || 0),
    },
    {
      icon: "box",
      label: "Total orders",
      note: "Orders you created",
      tone: "blue",
      value: String(orders.length),
    },
    {
      icon: "clock",
      label: "Open orders",
      note: "Not yet delivered",
      tone: "orange",
      value: String(openOrders.length),
    },
    {
      icon: "chart",
      label: "Order value",
      note: "All your orders",
      tone: "green",
      value: formatCurrency(orderValue),
    },
  ];

  const metrics =
    role === "ADMIN"
      ? adminMetrics
      : role === "WAREHOUSE"
        ? warehouseMetrics
        : role === "ACCOUNTS"
          ? accountMetrics
          : role === "SALES"
            ? salesMetrics
            : [];

  return (
    <>
      <PageHeading
        eyebrow={today}
        title={`Good day, ${user.name}`}
        description={
          descriptions[role] || "Dashboard data is not available for this role."
        }
      />
      {loading ? (
        <div className="empty-state" role="status">
          Loading live dashboard data…
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          {error}
        </div>
      ) : metrics.length === 0 ? (
        <div className="empty-state" role="alert">
          No dashboard is configured for this account role.
        </div>
      ) : (
        <>
          <section aria-label="Business overview" className="metrics-grid">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </section>

          <section className="dashboard-grid dashboard-grid-bottom">
            {role === "ACCOUNTS" ? (
              <article className="panel table-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Sales orders</h2>
                    <p>Orders recorded for the sales team.</p>
                  </div>
                </div>
                <DataTable
                  columns={[
                    "Order",
                    "Lead",
                    "Sales representative",
                    "Amount",
                    "Status",
                  ]}
                  rows={orders.slice(0, 5).map((order) => ({
                    id: order.id,
                    cells: [
                      <strong className="order-id">{order.id}</strong>,
                      <span>{order.customer}</span>,
                      <span>{order.salesRepresentative}</span>,
                      <strong>{formatCurrency(Number(order.total || 0))}</strong>,
                      <StatusBadge status={formatStatus(order.status)} />,
                    ],
                  }))}
                  emptyMessage="No sales orders have been recorded."
                />
              </article>
            ) : (
              <article className="panel table-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Orders</h2>
                    <p>Orders available from the CRM.</p>
                  </div>
                </div>
                <DataTable
                  columns={["Order", "Amount", "Status"]}
                  rows={orders.slice(0, 5).map((order) => ({
                    id: order.id,
                    cells: [
                      <strong className="order-id">{order.id}</strong>,
                      <strong>{formatCurrency(Number(order.total || 0))}</strong>,
                      <StatusBadge status={formatStatus(order.status)} />,
                    ],
                  }))}
                  emptyMessage="No orders have been recorded."
                />
              </article>
            )}

            {(role === "ADMIN" || role === "WAREHOUSE") && (
              <article className="panel low-stock-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Stock alerts</h2>
                    <p>Products with 10 units or fewer.</p>
                  </div>
                  <Icon name="package" size={18} />
                </div>
                <div className="stock-alert-list">
                  {lowStock.map((product) => (
                    <div className="stock-alert" key={product.id}>
                      <div className="product-thumb">
                        <Icon name="package" size={18} />
                      </div>
                      <div className="stock-alert-copy">
                        <strong>{product.name}</strong>
                        <span>{product.id}</span>
                      </div>
                      <span className="stock-count">{product.stock} left</span>
                    </div>
                  ))}
                  {!lowStock.length && (
                    <div className="empty-state">No low-stock products.</div>
                  )}
                </div>
              </article>
            )}
          </section>
        </>
      )}
    </>
  );
}
