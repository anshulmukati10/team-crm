import { useCallback, useEffect, useState } from "react";
import {
  DataTable,
  formatCurrency,
  Icon,
  Modal,
  PageHeading,
  StatusBadge,
} from "../../components/ui/Navbar";
import {
  createWarehouseImportRequest,
  getWarehouseRequests,
  getWarehouseStock,
} from "./wareHouseApi";
import useWorkspaceUpdates from "../../context/useWorkspaceUpdates";

function getErrorMessage(error) {
  return typeof error === "string"
    ? error
    : error?.message || "Unable to load stock requests.";
}

function requestStatus(status) {
  return {
    REQUESTED: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  }[String(status).toUpperCase()] || status;
}

export default function ImportRequest() {
  const workspaceVersion = useWorkspaceUpdates();
  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [requestData, stockData] = await Promise.all([
        getWarehouseRequests(),
        getWarehouseStock(),
      ]);
      if (!Array.isArray(requestData) || !Array.isArray(stockData)) {
        throw new Error("The API returned invalid stock request data.");
      }
      setRequests(requestData);
      setProducts(stockData);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadData);
  }, [loadData, workspaceVersion]);

  async function submitRequest(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedProduct = products.find(
      (product) => product.id === form.get("productId"),
    );
    if (!selectedProduct) {
      setError("Select a valid product.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createWarehouseImportRequest({
        amount: Number(form.get("amount")),
        note: String(form.get("note") || "").trim(),
        products: [{ id: selectedProduct.id }],
      });
      setShowForm(false);
      await loadData();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  const pending = requests.filter(
    (request) => String(request.status).toUpperCase() === "REQUESTED",
  ).length;
  const approved = requests.filter(
    (request) => String(request.status).toUpperCase() === "APPROVED",
  ).length;

  return (
    <>
      <PageHeading
        title="Stock requests"
        action={
          <button
            className="button button-primary"
            disabled={!products.length}
            onClick={() => setShowForm(true)}
            type="button"
          >
            <Icon name="plus" size={17} /> Request stock
          </button>
        }
      />
      {error && (
        <div className="inline-notice error-notice" role="alert">
          <Icon name="close" size={17} />
          <span>{error}</span>
        </div>
      )}
      <section className="metrics-grid metrics-grid-compact">
        <div className="mini-stat">
          <span className="mini-stat-icon icon-orange"><Icon name="clock" /></span>
          <div><span>Awaiting review</span><strong>{pending}</strong></div>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-icon icon-green"><Icon name="check" /></span>
          <div><span>Approved</span><strong>{approved}</strong></div>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-icon icon-blue"><Icon name="truck" /></span>
          <div><span>Total requests</span><strong>{requests.length}</strong></div>
        </div>
      </section>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div><h2>My stock requests</h2></div>
          <button
            className="button button-secondary"
            disabled={loading}
            onClick={loadData}
            type="button"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="empty-state" role="status">Loading requests…</div>
        ) : (
          <DataTable
            columns={["Request", "Products", "Amount", "Note", "Status"]}
            rows={requests.map((request) => ({
              id: request.id,
              cells: [
                <strong className="order-id">#{request.id}</strong>,
                <span>
                  {request.products?.map((product) => product.name).join(", ") ||
                    "—"}
                </span>,
                <strong>{formatCurrency(Number(request.amount || 0))}</strong>,
                <span>{request.note || "—"}</span>,
                <StatusBadge status={requestStatus(request.status)} />,
              ],
            }))}
            emptyMessage="No stock requests."
          />
        )}
      </section>
      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="Request stock">
          <form className="form-stack" onSubmit={submitRequest}>
            <label>
              Product
              <select name="productId" required>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.stock} in stock
                  </option>
                ))}
              </select>
            </label>
            <label>
              Request amount
              <input min="1" name="amount" required type="number" />
            </label>
            <label>
              Note
              <textarea name="note" rows="3" />
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
                {saving ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
