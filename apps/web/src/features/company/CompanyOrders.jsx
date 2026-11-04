import { useCallback, useEffect, useState } from "react";
import {
  DataTable,
  formatCurrency,
  formatDate,
  Icon,
  PageHeading,
  StatusBadge,
} from "../../components/ui/Navbar";
import { getCompanyOrders } from "./companyApi";

function displayStatus(status) {
  const normalized = String(status || "").toUpperCase();
  return {
    PLACED: "Pending",
    PROCESS: "Processing",
    DELIVERED: "Fulfilled",
  }[normalized] || normalized || "Unknown";
}

export default function CompanyOrders() {
  const [state, setState] = useState({ status: "loading" });

  const loadOrders = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const orders = await getCompanyOrders();
      setState({ status: "success", orders });
    } catch (error) {
      setState({ status: "error", error: error.message });
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadOrders);
  }, [loadOrders]);

  return (
    <>
      <PageHeading
        eyebrow="Company administration"
        title="Company orders"
        description="Orders placed by your company team."
        action={
          <button
            className="button button-secondary"
            disabled={state.status === "loading"}
            onClick={loadOrders}
            type="button"
          >
            <Icon name="clock" size={16} /> Refresh
          </button>
        }
      />
      {state.status === "loading" ? (
        <div className="empty-state" role="status">
          Loading company orders…
        </div>
      ) : state.status === "error" ? (
        <div className="empty-state" role="alert">
          <p>{state.error}</p>
          <button
            className="button button-secondary"
            onClick={loadOrders}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : (
        <section className="panel table-panel">
          <div className="table-toolbar">
            <div>
              <h2>Orders</h2>
              <p>
                {state.orders.length} order
                {state.orders.length === 1 ? "" : "s"} across your company.
              </p>
            </div>
          </div>
          <DataTable
            columns={[
              "Order",
              "Customer",
              "Sales representative",
              "Date",
              "Total",
              "Status",
              "Payment",
            ]}
            emptyMessage="No orders have been placed by your company."
            rows={state.orders.map((order) => ({
              id: order.id,
              cells: [
                <strong className="order-id">{order.id}</strong>,
                <span>{order.lead?.name || "—"}</span>,
                <span>{order.sales?.name || "—"}</span>,
                <span>{order.createdAt ? formatDate(order.createdAt) : "—"}</span>,
                <strong>{formatCurrency(Number(order.total || 0))}</strong>,
                <StatusBadge status={displayStatus(order.status)} />,
                order.payment ? (
                  <StatusBadge
                    status={
                      order.payment.status === "SUCCESS"
                        ? "Paid"
                        : order.payment.status === "FAIL"
                          ? "Failed"
                          : "Unpaid"
                    }
                  />
                ) : <span>—</span>,
              ],
            }))}
          />
        </section>
      )}
    </>
  );
}
