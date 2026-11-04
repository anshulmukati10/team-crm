import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Icon, PageHeading } from "../../components/ui/Navbar";
import { formatStripeAmounts, getCompanyStripeBalance } from "./companyApi";

export default function CompanyWallet() {
  const [state, setState] = useState({ status: "loading" });

  const loadBalance = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const balance = await getCompanyStripeBalance();
      setState({ status: "success", balance });
    } catch (loadError) {
      setState({ status: "error", error: loadError.message });
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadBalance);
  }, [loadBalance]);

  const balance = state.status === "success" ? state.balance : null;

  return (
    <>
      <PageHeading
        eyebrow="Company administration"
        title="Stripe balance"
        description="View the live available and pending balances from your connected Stripe account."
        action={
          <button
            className="button button-secondary"
            disabled={state.status === "loading"}
            onClick={loadBalance}
            type="button"
          >
            <Icon name="clock" size={16} /> Refresh balance
          </button>
        }
      />
      {state.status === "loading" ? (
        <div className="empty-state" role="status">
          Loading live Stripe balance…
        </div>
      ) : state.status === "error" ? (
        <div className="empty-state" role="alert">
          <p>{state.error}</p>
          <button
            className="button button-secondary"
            onClick={loadBalance}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : !balance.connected ? (
        <div className="empty-state">
          <p>Connect a Stripe account to view its live balance.</p>
          <Link className="button button-primary" to="/company/payments">
            Connect Stripe
          </Link>
        </div>
      ) : (
        <section aria-label="Connected Stripe account balance" className="company-dashboard-grid">
          <article className="panel company-stripe-balance">
            <span className="company-panel-icon">
              <Icon name="chart" size={21} />
            </span>
            <p className="eyebrow">Available</p>
            <strong>{formatStripeAmounts(balance.available)}</strong>
            <p>Live funds currently available in your connected Stripe account.</p>
          </article>
          <article className="panel company-stripe-balance">
            <span className="company-panel-icon">
              <Icon name="clock" size={21} />
            </span>
            <p className="eyebrow">Pending</p>
            <strong>{formatStripeAmounts(balance.pending)}</strong>
            <p>Funds processing before they become available.</p>
          </article>
        </section>
      )}
    </>
  );
}
