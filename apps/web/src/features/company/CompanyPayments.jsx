import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import {
  Icon,
  PageHeading,
  StatusBadge,
  DataTable,
} from "../../components/ui/Navbar";
import {
  createCompanyStripeOnboarding,
  getCompanyPayoutHistory,
  getCompanyStripeStatus,
} from "./companyApi";

function SetupStep({ complete, title, description }) {
  return (
    <li className="company-stripe-step">
      <span
        className={
          complete ? "company-stripe-step-check" : "company-stripe-step-pending"
        }
      >
        <Icon name={complete ? "check" : "clock"} size={16} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="company-stripe-step-status">
        {complete ? "Complete" : "Pending"}
      </span>
    </li>
  );
}

export default function CompanyPayments() {
  const location = useLocation();
  const [state, setState] = useState({ status: "loading" });
  const [history, setHistory] = useState({ status: "loading", payouts: [] });
  const [isStartingSetup, setIsStartingSetup] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refreshLinkPromise = useRef(null);
  const isRefreshingLink =
    location.pathname.endsWith("/refresh") && !error;

  const loadStatus = useCallback(async () => {
    setState({ status: "loading" });
    setError("");
    try {
      const result = await getCompanyStripeStatus();
      setState({ status: "success", connected: result.connected, account: result.account });
      return result;
    } catch (loadError) {
      setState({ status: "error", error: loadError.message });
      return null;
    }
  }, []);

  const loadPayoutHistory = useCallback(async (page = 1) => {
    setHistory((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const result = await getCompanyPayoutHistory(page);
      setHistory({ status: "success", ...result });
    } catch (loadError) {
      setHistory((current) => ({
        ...current,
        status: "error",
        error: loadError.message,
      }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(loadStatus)
      .then((result) => {
        if (!active || !result) return;
        if (location.pathname.endsWith("/return")) {
          setNotice(
            "Stripe onboarding returned to Team CRM. Your account status is shown below.",
          );
        }
      });
    loadPayoutHistory();

    if (location.pathname.endsWith("/refresh")) {
      refreshLinkPromise.current ??= Promise.resolve().then(
        createCompanyStripeOnboarding,
      );
      refreshLinkPromise.current
        .then((result) => {
          if (!active) return;
          const onboardingUrl = new URL(result.onboardingUrl);
          if (onboardingUrl.protocol !== "https:") {
            throw new Error("The Stripe onboarding link is not secure.");
          }
          window.location.assign(onboardingUrl.href);
        })
        .catch((setupError) => {
          if (!active) return;
          setError(setupError.message || "Unable to refresh Stripe setup.");
        });
    } else {
      refreshLinkPromise.current = null;
    }

    return () => {
      active = false;
    };
  }, [loadPayoutHistory, loadStatus, location.pathname]);

  async function handleStartSetup() {
    setIsStartingSetup(true);
    setError("");
    setNotice("");
    try {
      const result = await createCompanyStripeOnboarding();
      const onboardingUrl = new URL(result.onboardingUrl);
      if (onboardingUrl.protocol !== "https:") {
        throw new Error("The Stripe onboarding link is not secure.");
      }
      window.location.assign(onboardingUrl.href);
    } catch (setupError) {
      setError(setupError.message || "Unable to start Stripe account setup.");
      setIsStartingSetup(false);
    }
  }

  const account = state.status === "success" ? state.account : null;
  const isReady = Boolean(account?.canReceivePayments);
  const needsSetup = !isReady;
  const payoutRows = history.payouts.map((payout) => ({
    id: payout.id,
    cells: [
      new Date(payout.createdAt).toLocaleString(),
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: String(payout.currency || "USD").toUpperCase(),
      }).format(Number(payout.amount)),
      <StatusBadge key={`${payout.id}-status`} status={payout.status} />,
      payout.description || "—",
      payout.arrival_date
        ? new Date(payout.arrival_date).toLocaleDateString()
        : "—",
    ],
  }));

  return (
    <>
      <PageHeading
        eyebrow="Company administration"
        title="Payments"
        description="Connect your company’s Stripe account to accept card payments for customer orders."
        action={
          <button
            className="button button-secondary"
            disabled={state.status === "loading"}
            onClick={() => {
              loadStatus();
              loadPayoutHistory(history.page || 1);
            }}
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
            <strong>Stripe setup failed</strong>
            <span>{error}</span>
          </div>
        </div>
      )}
      {(notice || isRefreshingLink) && (
        <div className="inline-notice" role="status">
          <span className="notice-icon">
            <Icon name="check" size={17} />
          </span>
          <div>
            <strong>Stripe account status</strong>
            <span>
              {notice ||
                "Your Stripe setup link expired. Generating a fresh link…"}
            </span>
          </div>
        </div>
      )}
      {state.status === "loading" ? (
        <div className="empty-state" role="status">
          Loading Stripe account status…
        </div>
      ) : state.status === "error" ? (
        <div className="empty-state" role="alert">
          <p>{state.error}</p>
          <button
            className="button button-secondary"
            onClick={loadStatus}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="company-stripe-grid">
          <section className="panel company-stripe-summary">
            <div className="company-stripe-summary-top">
              <span className="company-panel-icon">
                <Icon name="chart" size={21} />
              </span>
              <StatusBadge
                status={
                  isReady ? "Ready" : state.connected ? "In setup" : "Not connected"
                }
              />
            </div>
            <p className="eyebrow">Stripe Connect</p>
            <h2>
              {isReady
                ? "Your company can accept payments"
                : "Set up payments for your company"}
            </h2>
            <p className="company-stripe-description">
              {isReady
                ? "Customers can pay for orders by card. Payments are processed through your connected Stripe account."
                : "Complete Stripe’s secure account setup to let your team collect card payments for orders."}
            </p>
            {state.connected && (
              <dl className="company-stripe-account-details">
                <div>
                  <dt>Country</dt>
                  <dd>{account?.country || "—"}</dd>
                </div>
                <div>
                  <dt>Settlement currency</dt>
                  <dd>{account?.currency?.toUpperCase() || "—"}</dd>
                </div>
              </dl>
            )}
            {needsSetup ? (
              <button
                className="button button-primary company-stripe-action"
                disabled={isStartingSetup || isRefreshingLink}
                onClick={handleStartSetup}
                type="button"
              >
                {isStartingSetup || isRefreshingLink
                  ? isRefreshingLink
                    ? "Refreshing Stripe link…"
                    : "Opening Stripe…"
                  : state.connected
                    ? "Continue Stripe setup"
                    : "Connect Stripe"}
              </button>
            ) : (
              <p className="company-stripe-ready-note">
                <Icon name="check" size={16} /> Order payments are enabled.
              </p>
            )}
          </section>
          <section
            aria-label="Stripe setup progress"
            className="panel company-stripe-checklist"
          >
            <div>
              <p className="eyebrow">Account requirements</p>
              <h2>Payment readiness</h2>
            </div>
            <ul>
              <SetupStep
                complete={Boolean(account?.detailsSubmitted)}
                description="Business information submitted to Stripe"
                title="Account details"
              />
              <SetupStep
                complete={Boolean(account?.chargesEnabled)}
                description="Card payments enabled for your account"
                title="Accept payments"
              />
              <SetupStep
                complete={Boolean(account?.payoutsEnabled)}
                description="Payouts enabled for your account"
                title="Receive payouts"
              />
            </ul>
            <p className="company-stripe-footnote">
              Stripe securely collects and verifies account details. Team CRM
              does not store your card details.
            </p>
          </section>
        </div>
      )}
      <section className="panel company-stripe-checklist">
        <div id="payout-history">
          <p className="eyebrow">Stripe Connect</p>
          <h2>Payout history</h2>
        </div>
        {history.status === "loading" ? (
          <div className="empty-state" role="status">
            Loading payout history…
          </div>
        ) : history.status === "error" ? (
          <div className="empty-state" role="alert">
            <p>{history.error}</p>
            <button
              className="button button-secondary"
              onClick={() => loadPayoutHistory(history.page || 1)}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <DataTable
              columns={["Date", "Amount", "Status", "Description", "Arrival"]}
              emptyMessage="No payouts have been recorded yet."
              rows={payoutRows}
            />
            {history.totalPages > 1 && (
              <div className="company-payout-pagination">
                <button
                  className="button button-secondary"
                  disabled={history.page <= 1}
                  onClick={() => loadPayoutHistory(history.page - 1)}
                  type="button"
                >
                  Previous
                </button>
                <span>
                  Page {history.page} of {history.totalPages}
                </span>
                <button
                  className="button button-secondary"
                  disabled={history.page >= history.totalPages}
                  onClick={() => loadPayoutHistory(history.page + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
