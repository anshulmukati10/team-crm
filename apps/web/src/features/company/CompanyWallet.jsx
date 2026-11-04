import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Icon, Modal, PageHeading } from "../../components/ui/Navbar";
import {
  formatStripeAmounts,
  getCompanyStripeBalance,
  getCompanyStripeStatus,
  requestCompanyPayout,
} from "./companyApi";

export default function CompanyWallet() {
  const [state, setState] = useState({ status: "loading" });
  const [isConfirmingPayout, setIsConfirmingPayout] = useState(false);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  const [payoutNotice, setPayoutNotice] = useState("");

  const loadBalance = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const balance = await getCompanyStripeBalance();
      let stripeStatus;
      let stripeStatusError = "";
      try {
        stripeStatus = await getCompanyStripeStatus();
      } catch (statusError) {
        stripeStatusError = statusError.message;
      }
      setState({ status: "success", balance, stripeStatus, stripeStatusError });
    } catch (loadError) {
      setState({ status: "error", error: loadError.message });
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadBalance);
  }, [loadBalance]);

  const balance = state.status === "success" ? state.balance : null;
  const payoutAmount =
    balance?.available?.find(
      ({ amount, currency }) =>
        String(currency).toLowerCase() === "usd" && Number(amount) > 0,
    ) || balance?.available?.find(({ amount }) => Number(amount) > 0);
  const payoutsEnabled = Boolean(state.stripeStatus?.account?.payoutsEnabled);

  async function handleRequestPayout() {
    setIsRequestingPayout(true);
    setPayoutError("");
    setPayoutNotice("");
    try {
      const result = await requestCompanyPayout();
      if (!result.success) {
        throw new Error(result.message || "There is no available balance to pay out.");
      }
      setIsConfirmingPayout(false);
      setPayoutNotice(
        "Your payout request was sent to Stripe. You can follow its status in Payments.",
      );
      await loadBalance();
    } catch (requestError) {
      setPayoutError(requestError.message);
    } finally {
      setIsRequestingPayout(false);
    }
  }

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
      {state.status === "success" && balance.connected && (
        <section className="panel company-stripe-payout">
          <div>
            <p className="eyebrow">Withdraw funds</p>
            <h2>Request a payout</h2>
            <p>
              Request a standard Stripe payout of your available balance.
              Payouts are sent to the bank account linked to Stripe.
            </p>
          </div>
          <div className="company-stripe-payout-action">
            {payoutError && (
              <p className="company-payout-error" role="alert">
                {payoutError}
              </p>
            )}
            {payoutNotice && (
              <p className="company-payout-success" role="status">
                {payoutNotice}
              </p>
            )}
            {state.stripeStatusError ? (
              <p className="company-payout-unavailable" role="alert">
                Unable to verify payout eligibility: {state.stripeStatusError}
              </p>
            ) : !payoutsEnabled ? (
              <>
                <p className="company-payout-unavailable">
                  Complete Stripe account setup to enable payouts.
                </p>
                <Link className="button button-secondary" to="/company/payments">
                  Finish Stripe setup
                </Link>
              </>
            ) : !payoutAmount ? (
              <p className="company-payout-unavailable">
                No available funds to pay out right now.
              </p>
            ) : (
              <button
                className="button button-primary"
                onClick={() => {
                  setPayoutError("");
                  setPayoutNotice("");
                  setIsConfirmingPayout(true);
                }}
                type="button"
              >
                Request payout
              </button>
            )}
            <Link
              className="company-payout-history-link"
              to="/company/payments#payout-history"
            >
              View payout history
            </Link>
          </div>
        </section>
      )}
      {isConfirmingPayout && payoutAmount && (
        <Modal
          description="This sends a request to Stripe for processing."
          onClose={() => {
            if (!isRequestingPayout) setIsConfirmingPayout(false);
          }}
          title="Confirm payout"
        >
          <div className="form-stack">
            {payoutError && (
              <p className="company-payout-error" role="alert">
                {payoutError}
              </p>
            )}
            <p>
              Your available balance is currently{" "}
              <strong>{formatStripeAmounts([payoutAmount])}</strong>. Stripe
              will pay out the available balance at submission time, so the
              amount may change if your balance changes before then.
            </p>
            <div className="modal-actions">
              <button
                className="button button-secondary"
                disabled={isRequestingPayout}
                onClick={() => setIsConfirmingPayout(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={isRequestingPayout}
                onClick={handleRequestPayout}
                type="button"
              >
                {isRequestingPayout ? "Requesting…" : "Confirm payout"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
