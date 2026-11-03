import { useCallback, useEffect, useState } from "react";
import { formatCurrency, Icon, PageHeading } from "../../components/ui/Navbar";
import { creditCompanyWallet, getCompanyWallet } from "./companyApi";

export default function CompanyWallet() {
  const [state, setState] = useState({ status: "loading" });
  const [amount, setAmount] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadWallet = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const wallet = await getCompanyWallet();
      setState({ status: "success", wallet });
    } catch (loadError) {
      setState({ status: "error", error: loadError.message });
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadWallet);
  }, [loadWallet]);

  async function handleSubmit(event) {
    event.preventDefault();
    const balance = Number(amount);
    if (!Number.isSafeInteger(balance) || balance <= 0) {
      setError("Enter a positive whole-number amount.");
      return;
    }

    setIsAdding(true);
    setError("");
    setNotice("");
    try {
      const result = await creditCompanyWallet(balance);
      setNotice(result.message || "Wallet balance added successfully.");
      setAmount("");
      await loadWallet();
    } catch (creditError) {
      setError(creditError.message || "Unable to add wallet balance.");
    } finally {
      setIsAdding(false);
    }
  }

  const wallet = state.status === "success" ? state.wallet : null;
  const remaining =
    wallet?.limit == null
      ? null
      : Math.max(0, Number(wallet.limit) - Number(wallet.balance));

  return (
    <>
      <PageHeading
        eyebrow="Company administration"
        title="Company wallet"
        description="Review the current company balance and add funds within your plan limit."
        action={
          <button
            className="button button-secondary"
            disabled={state.status === "loading"}
            onClick={loadWallet}
            type="button"
          >
            <Icon name="clock" size={16} /> Refresh
          </button>
        }
      />
      {error && (
        <div className="inline-notice" role="alert">
          <span className="notice-icon">
            <Icon name="bell" size={17} />
          </span>
          <div>
            <strong>Wallet action failed</strong>
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
            <strong>Wallet updated</strong>
            <span>{notice}</span>
          </div>
        </div>
      )}
      {state.status === "loading" ? (
        <div className="empty-state" role="status">
          Loading company wallet…
        </div>
      ) : state.status === "error" ? (
        <div className="empty-state" role="alert">
          <p>{state.error}</p>
          <button
            className="button button-secondary"
            onClick={loadWallet}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : (
        <section className="company-dashboard-grid">
          <article className="panel company-wallet-balance">
            <span className="company-panel-icon">
              <Icon name="chart" size={21} />
            </span>
            <p className="eyebrow">Available balance</p>
            <strong>{formatCurrency(Number(wallet.balance))}</strong>
            <p>
              {wallet.limit == null
                ? "No wallet cap is configured for the current plan."
                : `${formatCurrency(Number(wallet.limit))} maximum${wallet.planName ? ` on ${wallet.planName}` : ""}.`}
            </p>
            {remaining != null && (
              <p>{formatCurrency(remaining)} remaining before the plan cap.</p>
            )}
          </article>
          <article className="panel company-form-panel company-wallet-form-panel">
            <div className="panel-heading">
              <div>
                <h2>Add wallet balance</h2>
                <p>
                  The active subscription limit is checked before funds are
                  added.
                </p>
              </div>
              <span className="company-panel-icon">
                <Icon name="plus" size={20} />
              </span>
            </div>
            <form className="company-form" onSubmit={handleSubmit}>
              <label className="input-group" htmlFor="wallet-amount">
                <span>Amount (USD)</span>
                <input
                  disabled={isAdding}
                  id="wallet-amount"
                  min="1"
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  step="1"
                  type="number"
                  value={amount}
                />
              </label>
              <div className="company-form-footer">
                <p>Enter a whole-number amount to add to your company wallet.</p>
                <button
                  className="button button-primary"
                  disabled={isAdding}
                  type="submit"
                >
                  <Icon name="plus" size={16} />
                  {isAdding ? "Adding balance…" : "Add balance"}
                </button>
              </div>
            </form>
          </article>
        </section>
      )}
    </>
  );
}
