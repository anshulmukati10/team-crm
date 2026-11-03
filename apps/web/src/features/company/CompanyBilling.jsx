import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon, PageHeading } from "../../components/ui/Navbar";
import { useCompanyAuth } from "../../context/CompanyAuthContext";
import {
  createCompanyPayment,
  getCompanyPlans,
  getCompanySubscriptions,
  subscribeCompany,
} from "./companyApi";

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
let stripeScriptPromise;

function loadStripeLibrary() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (!stripeScriptPromise) {
    stripeScriptPromise = new Promise((resolve, reject) => {
      let script = document.querySelector('script[src="https://js.stripe.com/v3/"]');
      if (!script) {
        script = document.createElement("script");
        script.src = "https://js.stripe.com/v3/";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", () => {
        if (window.Stripe) resolve(window.Stripe);
        else reject(new Error("Stripe.js loaded but could not be initialized."));
      }, { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("Unable to load the secure payment form.")),
        { once: true },
      );
    });
  }
  return stripeScriptPromise;
}

function formatPlanPrice(plan) {
  if (plan.type === "FREE") return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(plan.price || 0) / 100);
}

function formatWalletBalanceLimit(plan) {
  const rawLimit = plan.details?.balance;
  if (rawLimit === null || rawLimit === undefined) return "Not configured";
  const limit = Number(rawLimit);
  return Number.isFinite(limit)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(limit)
    : "Not configured";
}

function latestSubscription(subscriptions) {
  return [...subscriptions].sort(
    (first, second) =>
      new Date(second.createdAt || second.startedAt || 0) -
      new Date(first.createdAt || first.startedAt || 0),
  )[0];
}

function StripeCardForm({ checkout, companyEmail, onComplete, onCancel }) {
  const cardElementRef = useRef(null);
  const cardRef = useRef(null);
  const [stripeState, setStripeState] = useState(null);
  const [error, setError] = useState(() =>
    stripeKey
      ? ""
      : "Online payment is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in the web app environment.",
  );
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    if (!stripeKey) return undefined;

    loadStripeLibrary()
      .then((Stripe) => {
        if (!active || !cardElementRef.current) return;
        const stripe = Stripe(stripeKey);
        const card = stripe.elements().create("card");
        card.mount(cardElementRef.current);
        cardRef.current = card;
        setStripeState({ stripe, card });
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });

    return () => {
      active = false;
      cardRef.current?.unmount();
      cardRef.current = null;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!stripeState) return;
    setError("");
    setIsConfirming(true);
    try {
      const result = await stripeState.stripe.confirmCardPayment(
        checkout.clientSecret,
        {
          payment_method: {
            card: stripeState.card,
            billing_details: { email: companyEmail },
          },
        },
      );
      if (result.error) {
        throw new Error(result.error.message || "The payment could not be confirmed.");
      }
      if (result.paymentIntent?.status !== "succeeded") {
        throw new Error("The payment has not completed yet.");
      }
      await onComplete();
    } catch (confirmError) {
      setError(confirmError.message || "The payment could not be confirmed.");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <section aria-label="Secure payment" className="company-payment-panel">
      <div className="company-payment-heading">
        <div>
          <p className="eyebrow">Secure checkout</p>
          <h3>Pay for {checkout.plan.name}</h3>
        </div>
        <button
          aria-label="Cancel payment"
          className="icon-button"
          disabled={isConfirming}
          onClick={onCancel}
          type="button"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      {error && (
        <p className="company-payment-error" role="alert">
          {error}
        </p>
      )}
      <form className="company-payment-form" onSubmit={handleSubmit}>
        <label className="input-group">
          <span>Card details</span>
          <div className="stripe-card-element" ref={cardElementRef} />
        </label>
        <p className="company-payment-note">
          Card details are securely collected by Stripe and are not stored by
          Team CRM.
        </p>
        <button
          className="button button-primary"
          disabled={!stripeState || isConfirming}
          type="submit"
        >
          {isConfirming ? "Confirming payment…" : "Confirm payment"}
        </button>
      </form>
    </section>
  );
}

export default function CompanyBilling() {
  const { company } = useCompanyAuth();
  const [loadState, setLoadState] = useState({ status: "loading" });
  const [busyPlanId, setBusyPlanId] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadBilling = useCallback(async () => {
    setLoadState({ status: "loading" });
    try {
      const [plans, subscriptions] = await Promise.all([
        getCompanyPlans(),
        getCompanySubscriptions(),
      ]);
      const data = {
        plans: Array.isArray(plans) ? plans : [],
        subscription: latestSubscription(
          Array.isArray(subscriptions) ? subscriptions : [],
        ),
      };
      setLoadState({ status: "success", ...data });
      return data;
    } catch (loadError) {
      setLoadState({ status: "error", error: loadError.message });
      return null;
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadBilling);
  }, [loadBilling]);

  const currentPlan = useMemo(
    () =>
      loadState.plans?.find(
        (plan) => String(plan.id) === String(loadState.subscription?.planId),
      ),
    [loadState.plans, loadState.subscription],
  );

  async function handleChoosePlan(plan) {
    if (busyPlanId) return;
    setBusyPlanId(plan.id);
    setError("");
    setNotice("");
    setCheckout(null);
    try {
      if (plan.type === "FREE") {
        await subscribeCompany(plan.id);
        await loadBilling();
        setNotice(`${plan.name} is now selected for your company.`);
      } else {
        if (!stripeKey) {
          throw new Error(
            "Online payment is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in the web app environment.",
          );
        }
        const payment = await createCompanyPayment(plan.id);
        if (!payment?.client) {
          throw new Error("The payment service did not return a secure client secret.");
        }
        setCheckout({
          clientSecret: payment.client,
          plan,
        });
      }
    } catch (chooseError) {
      setError(chooseError.message || "Unable to select this plan.");
    } finally {
      setBusyPlanId(null);
    }
  }

  async function handlePaymentComplete() {
    setCheckout(null);
    setNotice("Payment confirmed. Your subscription will update after payment processing completes.");
    await loadBilling();
  }

  return (
    <>
      <PageHeading
        eyebrow="Company administration"
        title="Plans & billing"
        description="Review your active subscription and manage your company plan."
        action={
          <button
            className="button button-secondary"
            disabled={loadState.status === "loading"}
            onClick={loadBilling}
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
            <strong>Subscription update failed</strong>
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
            <strong>Subscription update</strong>
            <span>{notice}</span>
          </div>
        </div>
      )}
      {loadState.status === "loading" ? (
        <div className="empty-state" role="status">
          Loading plans and subscription…
        </div>
      ) : loadState.status === "error" ? (
        <div className="empty-state" role="alert">
          <p>{loadState.error}</p>
          <button
            className="button button-secondary"
            onClick={loadBilling}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <section className="panel company-active-subscription">
            <div className="company-active-copy">
              <span className="company-panel-icon">
                <Icon name="chart" size={20} />
              </span>
              <div>
                <p className="eyebrow">Current subscription</p>
                <h2>{currentPlan?.name || "No plan details available"}</h2>
                <p>
                  {currentPlan
                    ? `${formatPlanPrice(currentPlan)}${currentPlan.type === "FREE" ? "" : " / month"}`
                    : "Choose a plan below to manage your company subscription."}
                </p>
              </div>
            </div>
            <span className="company-active-status">
              {loadState.subscription?.status || "No subscription"}
            </span>
          </section>
          <section aria-label="Available plans" className="company-plan-grid">
            {loadState.plans.map((plan) => {
              const isCurrent =
                String(plan.id) === String(loadState.subscription?.planId) &&
                loadState.subscription?.status === "ACTIVE";
              const isBusy = String(busyPlanId) === String(plan.id);
              return (
                <article
                  className={`panel company-plan-card ${isCurrent ? "company-plan-current" : ""}`}
                  key={plan.id}
                >
                  <div className="company-plan-top">
                    <div>
                      <p className="eyebrow">{plan.type} plan</p>
                      <h2>{plan.name}</h2>
                    </div>
                    {isCurrent && (
                      <span className="company-current-label">Current</span>
                    )}
                  </div>
                  <p className="company-plan-price">{formatPlanPrice(plan)}</p>
                  {plan.type !== "FREE" && (
                    <p className="company-plan-period">per month</p>
                  )}
                  <ul className="company-plan-limits">
                    <li>
                      <Icon name="check" size={16} />
                      Up to {plan.details?.maxMember ?? "—"} team members
                    </li>
                    <li>
                      <Icon name="check" size={16} />
                      Up to {plan.details?.maxOrder ?? "—"} orders
                    </li>
                    <li>
                      <Icon name="check" size={16} />
                      Wallet balance cap: {formatWalletBalanceLimit(plan)}
                    </li>
                  </ul>
                  <button
                    className={`button ${isCurrent ? "button-secondary" : "button-primary"} company-plan-button`}
                    disabled={isCurrent || Boolean(busyPlanId)}
                    onClick={() => handleChoosePlan(plan)}
                    type="button"
                  >
                    {isCurrent
                      ? "Current plan"
                      : isBusy
                        ? "Processing…"
                        : plan.type === "FREE"
                          ? "Select free plan"
                          : "Continue to payment"}
                  </button>
                </article>
              );
            })}
          </section>
          {!loadState.plans.length && (
            <div className="empty-state">
              No active plans are available for this company.
            </div>
          )}
          {checkout && (
            <StripeCardForm
              checkout={checkout}
              companyEmail={company.email}
              onCancel={() => setCheckout(null)}
              onComplete={handlePaymentComplete}
            />
          )}
        </>
      )}
    </>
  );
}
