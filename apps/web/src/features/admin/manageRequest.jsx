import { useCallback, useEffect, useState } from "react";
import {
  DataTable,
  formatCurrency,
  Icon,
  PageHeading,
  StatusBadge,
} from "../../components/ui/Navbar";
import {
  creditAdminWallet,
  getAdminBalance,
  getAdminRequests,
  processAdminRequest,
} from "./adminApi";
import useWorkspaceUpdates from "../../context/useWorkspaceUpdates";

function displayStatus(status) {
  return {
    REQUESTED: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  }[status] || status;
}

export default function ManageRequests() {
  const workspaceVersion = useWorkspaceUpdates();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [funding, setFunding] = useState(false);
  const [balance, setBalance] = useState(null);
  const [balanceError, setBalanceError] = useState("");
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadBalance = useCallback(async () => {
    setBalanceLoading(true);
    setBalanceError("");
    try {
      const wallet = await getAdminBalance();
      setBalance(Number(wallet.balance));
    } catch (loadError) {
      setBalance(null);
      setBalanceError(loadError.message);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async (isRefresh = false) => {
    setError("");
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getAdminRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAdminRequests()
      .then((data) => {
        if (!cancelled) setRequests(Array.isArray(data) ? data : []);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    Promise.resolve().then(loadBalance);

    return () => {
      cancelled = true;
    };
  }, [loadBalance, workspaceVersion]);

  async function handleProcess(requestId) {
    setProcessingId(requestId);
    setError("");
    setNotice("");
    try {
      const result = await processAdminRequest(requestId);
      if (result.message === "APPROVED") {
        setNotice(`Request #${requestId} was approved.`);
      } else if (result.message === "REJECTED") {
        setNotice(
          `Request #${requestId} was rejected because the admin wallet has insufficient funds.`,
        );
      } else {
        throw new Error("The server returned an unknown request status.");
      }
      await loadRequests(true);
      await loadBalance();
    } catch (processError) {
      setError(processError.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCreditWallet(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const amount = Number(new FormData(formElement).get("amount"));
    setFunding(true);
    setError("");
    setNotice("");
    try {
      const result = await creditAdminWallet(amount);
      setNotice(result.message || "Funds were added to the admin wallet.");
      formElement.reset();
      await loadBalance();
    } catch (creditError) {
      setError(creditError.message);
    } finally {
      setFunding(false);
    }
  }

  const pendingCount = requests.filter(
    (request) => request.status === "REQUESTED",
  ).length;

  return (
    <>
      <PageHeading
        eyebrow="Administration"
        title="Stock requests"
        action={
          <button
            className="button button-secondary"
            disabled={refreshing || loading}
            onClick={() => {
              loadRequests(true);
              loadBalance();
            }}
            type="button"
          >
            <Icon name="clock" size={16} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        }
      />
      <section className="metrics-grid metrics-grid-compact">
        <div className="mini-stat">
          <span className="mini-stat-icon icon-orange">
            <Icon name="clock" />
          </span>
          <div>
            <span>Awaiting processing</span>
            <strong>{pendingCount}</strong>
          </div>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-icon icon-green">
            <Icon name="check" />
          </span>
          <div>
            <span>Approved</span>
            <strong>
              {requests.filter((request) => request.status === "APPROVED").length}
            </strong>
          </div>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-icon icon-blue">
            <Icon name="truck" />
          </span>
          <div>
            <span>Total requests</span>
            <strong>{requests.length}</strong>
          </div>
        </div>
      </section>
      {error && (
        <div className="inline-notice" role="alert">
          <span className="notice-icon">
            <Icon name="bell" size={17} />
          </span>
          <div>
            <strong>Could not complete the request</strong>
            <span>{error}</span>
          </div>
        </div>
      )}
      {notice && (
        <div className="inline-notice" role="status">
          <span className="notice-icon">
            <Icon name="check" size={17} />
          </span>
          <div>
            <strong>Request processed</strong>
            <span>{notice}</span>
          </div>
        </div>
      )}
      <section className="panel form-stack">
        <div className="panel-heading">
          <div>
            <h2>Fund the admin wallet</h2>
            <p>Request processing uses this wallet to cover approved requests.</p>
          </div>
        </div>
        <form className="form-row" onSubmit={handleCreditWallet}>
          <label>
            Amount
            <input
              min="1"
              name="amount"
              placeholder="Amount in whole dollars"
              required
              step="1"
              type="number"
            />
          </label>
           <label>
             Wallet balance
             <output className="wallet-balance" aria-live="polite">
               {balanceLoading
                 ? "Loading…"
                 : balanceError
                   ? "Unavailable"
                   : formatCurrency(balance)}
             </output>
             {balanceError && (
               <span className="form-error" role="alert">
                 {balanceError}
               </span>
             )}
           </label>
          <button
            className="button button-primary"
            disabled={funding}
            type="submit"
          >
            {funding ? "Adding funds…" : "Add funds"}
          </button>
        </form>
      </section>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div>
            <h2>All requests</h2>
            <p>Request outcome is determined by the admin wallet balance.</p>
          </div>
        </div>
        {loading ? (
          <div className="empty-state" role="status">
            Loading requests…
          </div>
        ) : (
          <DataTable
            columns={["Request", "Products", "Amount", "Note", "Status", ""]}
            rows={requests.map((request) => ({
              id: request.id,
              cells: [
                <strong className="order-id">#{request.id}</strong>,
                <div>
                  {request.products?.length
                    ? request.products.map((product, index) => (
                        <div key={`${product.name}-${index}`}>
                          <strong>{product.name}</strong>
                          <small className="cell-subtitle">
                            {product.stock} in stock
                          </small>
                        </div>
                      ))
                    : <span>No product details</span>}
                </div>,
                <strong>{formatCurrency(request.amount)}</strong>,
                <span>{request.note || "—"}</span>,
                <StatusBadge status={displayStatus(request.status)} />,
                request.status === "REQUESTED" ? (
                  <button
                    className="button button-small button-primary"
                    disabled={processingId !== null}
                    onClick={() => handleProcess(request.id)}
                    type="button"
                  >
                    {processingId === request.id ? "Processing…" : "Process"}
                  </button>
                ) : (
                  <span>—</span>
                ),
              ],
            }))}
            emptyMessage="There are no stock requests to review."
          />
        )}
        <div className="table-bottom">
          <span>
            Showing <strong>{requests.length}</strong> requests
          </span>
          <span>Processing may approve or reject a request based on available funds.</span>
        </div>
      </section>
    </>
  );
}