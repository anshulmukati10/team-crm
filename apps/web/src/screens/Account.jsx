import { useEffect, useMemo, useState } from "react";
import {
  DataTable,
  MetricCard,
  PageHeading,
  StatusBadge,
  formatCurrency,
  formatDate,
} from "../components/ui/Navbar";
import { useAuth } from "../context/WorkspaceContext";
import {
  getAccountBalance,
  getAccountSales,
} from "../features/accounts/accountApi";
import useWorkspaceUpdates from "../context/useWorkspaceUpdates";

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
    .sort(
      (first, second) =>
        new Date(second.createdAt) - new Date(first.createdAt),
    );
}

function formatOrderStatus(status) {
  return {
    DELIVERED: "Fulfilled",
    PLACED: "Pending",
    PROCESS: "Processing",
  }[String(status).toUpperCase()] || status;
}

export default function Accounts() {
  const { role } = useAuth();
  const workspaceVersion = useWorkspaceUpdates();
  const [loadState, setLoadState] = useState({
    role: null,
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    Promise.all([getAccountSales(), getAccountBalance()])
      .then(([sales, balance]) => {
        if (active) {
          setLoadState({ role, status: "success", sales, balance });
        }
      })
      .catch((loadError) => {
        if (active) {
          setLoadState({
            role,
            status: "error",
            error: loadError.message || "Unable to load account data.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [role, workspaceVersion]);

  const loading = loadState.role !== role || loadState.status === "loading";
  const error =
    loadState.status === "error" && loadState.role === role
      ? loadState.error
      : "";
  const orders = useMemo(
    () => getAccountOrders(loadState.sales || []),
    [loadState.sales],
  );
  const completed = orders.filter(
    (order) => String(order.status).toUpperCase() === "DELIVERED",
  ).length;
  const revenue = orders.reduce(
    (sum, order) =>
      sum +
      (String(order.status).toUpperCase() === "DELIVERED"
        ? Number(order.total || 0)
        : 0),
    0,
  );

  return (
    <>
      <PageHeading
        title="Accounts"
        description="A clear view of balances and recent financial activity."
      />
      {loading ? (
        <div className="empty-state" role="status">
          Loading account data…
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          {error}
        </div>
      ) : (
        <>
          <section className="metrics-grid">
            <MetricCard
              icon="chart"
              label="Available balance"
              note="Current wallet balance"
              tone="blue"
              value={formatCurrency(loadState.balance)}
            />
            <MetricCard
              icon="box"
              label="Sales revenue"
              note="From fulfilled orders"
              tone="green"
              value={formatCurrency(revenue)}
            />
            <MetricCard
              icon="check"
              label="Completed orders"
              note={`${orders.length} orders in total`}
              tone="purple"
              value={String(completed).padStart(2, "0")}
            />
            <MetricCard
              icon="clock"
              label="Pending orders"
              note="Awaiting fulfillment"
              tone="orange"
              value={String(orders.length - completed).padStart(2, "0")}
            />
          </section>
          <section className="panel table-panel accounts-table">
            <div className="table-toolbar">
              <div>
                <h2>Recent transactions</h2>
                <p>Recent orders across the sales team.</p>
              </div>
            </div>
            <DataTable
              columns={[
                "Customer",
                "Sales representative",
                "Date",
                "Amount",
                "Status",
              ]}
              rows={orders.map((order) => ({
                id: order.id,
                cells: [
                  <div>
                    <strong>{order.customer || "Sales order"}</strong>
                    <small className="cell-subtitle">{order.id}</small>
                  </div>,
                  <span>{order.salesRepresentative || "—"}</span>,
                  <span>
                    {order.createdAt ? formatDate(order.createdAt) : "—"}
                  </span>,
                  <strong className="amount-positive">
                    +{formatCurrency(Number(order.total || 0))}
                  </strong>,
                  <StatusBadge status={formatOrderStatus(order.status)} />,
                ],
              }))}
              emptyMessage="No sales orders have been recorded."
            />
            <div className="table-bottom">
              <span>
                Showing <strong>{orders.length}</strong> transactions
              </span>
              <span>Currency: USD</span>
            </div>
          </section>
        </>
      )}
    </>
  );
}
