import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useCompanyAuth } from "../../context/CompanyAuthContext";
import {
  DataTable,
  formatCurrency,
  formatDate,
  Icon,
  MetricCard,
  PageHeading,
  StatusBadge,
} from "../../components/ui/Navbar";
import {
  getCompanyMembers,
  getCompanyOrders,
  getCompanyPlans,
  getCompanyRecordings,
  getCompanyStripeBalance,
  getCompanySubscriptions,
  formatStripeAmounts,
} from "./companyApi";

function getLatestSubscription(subscriptions) {
  return [...subscriptions].sort(
    (first, second) =>
      new Date(second.createdAt || second.startedAt || 0) -
      new Date(first.createdAt || first.startedAt || 0),
  )[0];
}

function formatWalletBalanceLimit(plan) {
  const rawLimit = plan?.details?.balance;
  if (rawLimit === null || rawLimit === undefined) return "Not configured";
  const limit = Number(rawLimit);
  return Number.isFinite(limit)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(limit)
    : "Not configured";
}

function displayStatus(status) {
  const normalized = String(status || "").toUpperCase();
  return {
    PLACED: "Pending",
    PROCESS: "Processing",
    DELIVERED: "Fulfilled",
  }[normalized] || normalized || "Unknown";
}

export default function CompanyDashboard() {
  const { company } = useCompanyAuth();
  const [state, setState] = useState({ status: "loading" });

  const loadCompanyData = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const [plans, subscriptions, members, stripeBalance, orders, recordings] = await Promise.all([
        getCompanyPlans(),
        getCompanySubscriptions(),
        getCompanyMembers(),
        getCompanyStripeBalance(),
        getCompanyOrders(),
        getCompanyRecordings(),
      ]);
      setState({
        status: "success",
        plans,
        members,
        stripeBalance,
        orders,
        recordings,
        subscription: getLatestSubscription(
          subscriptions,
        ),
      });
    } catch (error) {
      setState({ status: "error", error: error.message });
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadCompanyData);
  }, [loadCompanyData]);

  const currentPlan = state.plans?.find(
    (plan) => String(plan.id) === String(state.subscription?.planId),
  );

  return (
    <>
      <PageHeading
        eyebrow="Company owner"
        title={`Welcome, ${company.name}`}
        description="Manage your company workspace, team access, and subscription."
        action={
          <Link className="button button-primary" to="/company/subscription">
            <Icon name="chart" size={16} /> Manage subscription
          </Link>
        }
      />
      {state.status === "loading" ? (
        <div className="empty-state" role="status">
          Loading company information…
        </div>
      ) : state.status === "error" ? (
        <div className="empty-state" role="alert">
          <p>{state.error}</p>
          <button
            className="button button-secondary"
            onClick={loadCompanyData}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <section
            aria-label="Company account overview"
            className="metrics-grid company-metrics-grid"
          >
            <MetricCard
              icon="grid"
              label="Current plan"
              note={currentPlan?.type || "Plan details unavailable"}
              tone="blue"
              value={currentPlan?.name || "Not available"}
            />
            <MetricCard
              icon="check"
              label="Subscription status"
              note="Latest company subscription"
              tone="green"
              value={
                state.subscription?.status
                  ? state.subscription.status.toLowerCase()
                  : "No subscription"
              }
            />
            <MetricCard
              icon="users"
              label="Total team members"
              note={`Plan limit: ${currentPlan?.details?.maxMember ?? "Not configured"}`}
              tone="purple"
              value={String(state.members.total)}
            />
            <MetricCard
              icon="chart"
              label="Stripe available balance"
              note={state.stripeBalance.connected ? "Live from Stripe" : "Connect Stripe to view"}
              tone="green"
              value={
                state.stripeBalance.connected
                  ? formatStripeAmounts(state.stripeBalance.available)
                  : "Not connected"
              }
            />
            <MetricCard
              icon="box"
              label="Company orders"
              note="Orders placed by your team"
              tone="orange"
              value={String(state.orders.length)}
            />
            <MetricCard
              icon="clock"
              label="Plan renewal"
              note="End date from subscription"
              tone="orange"
              value={
                state.subscription?.endAt
                  ? new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }).format(new Date(state.subscription.endAt))
                  : "—"
              }
            />
          </section>
          <section className="company-dashboard-grid">
            <article className="panel company-welcome-panel">
              <span className="company-panel-icon">
                <Icon name="grid" size={21} />
              </span>
              <p className="eyebrow">Your company workspace</p>
              <h2>{company.name}</h2>
              <p>
                Use the owner portal to keep your team and subscription in one
                place. Operational CRM tools remain available to your team in
                their workspace.
              </p>
              <div className="company-actions">
                <Link className="button button-primary" to="/company/team">
                  Manage team members
                </Link>
                <Link className="button button-secondary" to="/company/wallet">
                  View Stripe balance
                </Link>
                <Link
                  className="button button-secondary"
                  to="/company/subscription"
                >
                  View plans
                </Link>
              </div>
            </article>
            <article className="panel company-subscription-panel">
              <div className="panel-heading">
                <div>
                  <h2>Subscription</h2>
                  <p>Your current company plan.</p>
                </div>
                <Icon name="chart" size={19} />
              </div>
              <div className="company-current-plan">
                <strong>{currentPlan?.name || "Plan not available"}</strong>
                <StatusBadge
                  status={state.subscription?.status || "Unavailable"}
                />
              </div>
              <p>
                {currentPlan?.details
                  ? `Includes up to ${currentPlan.details.maxMember} team members and a wallet balance cap of ${formatWalletBalanceLimit(currentPlan)}.`
                  : "Review the available plans to manage your subscription."}
              </p>
              <Link className="panel-footer-link" to="/company/subscription">
                Review plans & billing <Icon name="chevron" size={14} />
              </Link>
            </article>
          </section>
          <section className="panel table-panel company-dashboard-recordings">
            <div className="table-toolbar">
              <div>
                <h2>Meeting recordings</h2>
                <p>Recordings uploaded by your company team.</p>
              </div>
              <span className="text-button">
                {state.recordings.length} total
              </span>
            </div>
            {state.recordings.length ? (
              <div className="company-recording-list">
                {state.recordings.slice(0, 5).map((recording) => (
                  <article className="company-recording-item" key={recording.id}>
                    <div>
                      <strong>Meeting recording</strong>
                      <span>
                        {recording.date ? formatDate(recording.date) : "Date unavailable"}
                      </span>
                    </div>
                    <a
                      className="button button-secondary"
                      href={recording.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Icon name="arrow" size={15} /> Watch
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No meeting recordings have been uploaded by your team.
              </div>
            )}
          </section>
          <section className="panel table-panel company-dashboard-orders">
            <div className="table-toolbar">
              <div>
                <h2>Recent company orders</h2>
                <p>Latest orders placed by your company team.</p>
              </div>
              <Link className="text-button" to="/company/orders">
                View all orders
              </Link>
            </div>
            <DataTable
              columns={["Order", "Customer", "Date", "Total", "Status"]}
              emptyMessage="No orders have been placed by your company."
              rows={state.orders.slice(0, 5).map((order) => ({
                id: order.id,
                cells: [
                  <strong className="order-id">{order.id}</strong>,
                  <span>{order.lead?.name || "—"}</span>,
                  <span>{order.createdAt ? formatDate(order.createdAt) : "—"}</span>,
                  <strong>{formatCurrency(Number(order.total || 0))}</strong>,
                  <StatusBadge status={displayStatus(order.status)} />,
                ],
              }))}
            />
          </section>
        </>
      )}
    </>
  );
}
