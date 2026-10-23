import { useCallback, useEffect, useState } from "react";
import {
  DataTable,
  formatCurrency,
  Icon,
  Modal,
  PageHeading,
  StatusBadge,
} from "../../components/ui/Navbar";
import { useAuth } from "../../context/WorkspaceContext";
import { createSalesOrder, getSalesOrders } from "./salesApi";
import { exportWarehouseOrder, getWarehouseOrders } from "../warehouse/wareHouseApi";
import useWorkspaceUpdates from "../../context/useWorkspaceUpdates";
import { getAccountSales } from "../accounts/accountApi";

function getErrorMessage(error) {
  return typeof error === "string"
    ? error
    : error?.message || "Unable to load orders.";
}

function displayStatus(status) {
  return {
    DELIVERED: "Fulfilled",
    PLACED: "Pending",
    PROCESS: "Processing",
  }[String(status).toUpperCase()] || status;
}

export default function Orders() {
  const { role, user } = useAuth();
  const workspaceVersion = useWorkspaceUpdates();
  const [orders, setOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadOrders = useCallback(async () => {
    setError("");
    try {
      const result =
        role === "SALES"
          ? await getSalesOrders()
          : role === "ACCOUNTS"
            ? (await getAccountSales()).flatMap((salesUser) =>
                (salesUser.leads || []).flatMap((lead) =>
                  (lead.orders || []).map((order) => ({
                    ...order,
                    customer: lead.name,
                    salesRepresentative: salesUser.name,
                  })),
                ),
              )
            : await getWarehouseOrders();
      if (!Array.isArray(result)) throw new Error("Invalid orders response.");
      setOrders(result);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    Promise.resolve().then(loadOrders);
  }, [loadOrders, role, workspaceVersion]);

  async function submitOrder(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const salesId = Number(user.id);
    const leadId = String(form.get("leadId") || "").trim();
    const productId = String(form.get("productId") || "").trim();
    const quantity = Number(form.get("quantity"));
    if (!Number.isInteger(salesId) || salesId < 1) {
      setError("The signed-in account does not have a valid sales ID.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await createSalesOrder({
        salesId,
        leadId,
        orderItems: [{ productId, quantity }],
      });
      setShowForm(false);
      setNotice("Order created.");
      await loadOrders();
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  async function handleFulfill(orderId) {
    setProcessingId(orderId);
    setError("");
    setNotice("");
    try {
      await exportWarehouseOrder(orderId);
      setNotice(`Order ${orderId} was processed.`);
      await loadOrders();
    } catch (processError) {
      setError(getErrorMessage(processError));
    } finally {
      setProcessingId(null);
    }
  }

  const openCount = orders.filter(
    (order) => !["DELIVERED", "FULFILLED"].includes(String(order.status).toUpperCase()),
  ).length;

  return (
    <>
      <PageHeading
        title="Orders"
        action={
          role === "SALES" ? (
            <button
              className="button button-primary"
              onClick={() => setShowForm(true)}
              type="button"
            >
              <Icon name="plus" size={17} /> Create order
            </button>
          ) : null
        }
      />
      {(error || notice) && (
        <div
          className={`inline-notice ${error ? "error-notice" : ""}`}
          role={error ? "alert" : "status"}
        >
          <Icon name={error ? "close" : "check"} size={17} />
          <span>{error || notice}</span>
        </div>
      )}
      <section className="metrics-grid metrics-grid-compact">
        <div className="mini-stat">
          <span className="mini-stat-icon icon-blue"><Icon name="box" /></span>
          <div><span>Orders</span><strong>{orders.length}</strong></div>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-icon icon-orange"><Icon name="clock" /></span>
          <div><span>Open</span><strong>{openCount}</strong></div>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-icon icon-green"><Icon name="check" /></span>
          <div>
            <span>Fulfilled</span>
            <strong>
              {orders.filter(
                (order) =>
                  ["DELIVERED", "FULFILLED"].includes(
                    String(order.status).toUpperCase(),
                  ),
              ).length}
            </strong>
          </div>
        </div>
      </section>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div><h2>Order history</h2></div>
          <button
            className="button button-secondary"
            disabled={loading}
            onClick={loadOrders}
            type="button"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="empty-state" role="status">Loading orders…</div>
        ) : (
          <DataTable
            columns={["Order", "Amount", "Status", ...(role === "WAREHOUSE" ? [""] : [])]}
            rows={orders.map((order) => ({
              id: order.id,
              cells: [
                <strong className="order-id">{order.id}</strong>,
                <strong>{formatCurrency(Number(order.total || 0))}</strong>,
                <StatusBadge status={displayStatus(order.status)} />,
                ...(role === "WAREHOUSE"
                  ? [
                      String(order.status).toUpperCase() === "PLACED" ? (
                        <button
                          className="text-button"
                          disabled={processingId !== null}
                          onClick={() => handleFulfill(order.id)}
                          type="button"
                        >
                          {processingId === order.id ? "Processing…" : "Process order"}
                        </button>
                      ) : <span />,
                    ]
                  : []),
              ],
            }))}
            emptyMessage="No orders found."
          />
        )}
      </section>
      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="Create order">
          <form className="form-stack" onSubmit={submitOrder}>
            <label>
              Lead ID
              <input autoFocus name="leadId" required />
            </label>
            <label>
              Product ID
              <input name="productId" required />
            </label>
            <label>
              Quantity
              <input min="1" name="quantity" required type="number" />
            </label>
            <div className="modal-actions">
              <button
                className="button button-secondary"
                onClick={() => setShowForm(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={saving}
                type="submit"
              >
                {saving ? "Creating…" : "Create order"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
