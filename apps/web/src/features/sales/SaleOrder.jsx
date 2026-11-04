import { useCallback, useEffect, useRef, useState } from "react";
import {
  DataTable,
  formatCurrency,
  Icon,
  Modal,
  PageHeading,
  StatusBadge,
} from "../../components/ui/Navbar";
import { useAuth } from "../../context/WorkspaceContext";
import {
  confirmOrderPayment,
  createSalesOrder,
  getOrderPaymentIntent,
  getSalesLeads,
  getSalesOrders,
} from "./salesApi";
import {
  deliverWarehouseOrder,
  exportWarehouseOrder,
  getWarehouseOrders,
  getWarehouseStock,
} from "../warehouse/wareHouseApi";
import useWorkspaceUpdates from "../../context/useWorkspaceUpdates";
import { getAccountSales } from "../accounts/accountApi";

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

function StripeOrderCardForm({ checkout, email, onComplete, onCancel }) {
  const cardElementRef = useRef(null);
  const cardRef = useRef(null);
  const [stripeState, setStripeState] = useState(null);
  const [error, setError] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const setupError = !stripeKey
    ? "Online payment is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in the web app environment."
    : !checkout?.stripeAccountId || !checkout?.clientSecret
      ? "The order payment is missing its Stripe account or client secret."
      : "";

  useEffect(() => {
    let active = true;
    if (!stripeKey || !checkout?.stripeAccountId || !checkout?.clientSecret) {
      return undefined;
    }

    loadStripeLibrary()
      .then((Stripe) => {
        if (!active || !cardElementRef.current) return;
        const stripe = Stripe(stripeKey, {
          stripeAccount: checkout.stripeAccountId,
        });
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
      setStripeState(null);
    };
  }, [checkout?.clientSecret, checkout?.stripeAccountId]);

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
            billing_details: { email },
          },
        },
      );
      if (result.error) {
        throw new Error(result.error.message || "The payment could not be confirmed.");
      }
      if (result.paymentIntent?.status !== "succeeded") {
        throw new Error("The payment has not completed yet.");
      }
      await onComplete(checkout);
    } catch (confirmError) {
      setError(confirmError.message || "The payment could not be confirmed.");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <p>Order total: <strong>{formatCurrency(Number(checkout.amount || 0))}</strong></p>
      <p>Charge this card directly to the company’s connected Stripe account.</p>
      <div className="company-payment-card" ref={cardElementRef} />
      {(error || setupError) && (
        <p className="form-error" role="alert">{error || setupError}</p>
      )}
      <div className="modal-actions">
        <button
          className="button button-secondary"
          disabled={isConfirming}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="button button-primary"
          disabled={!stripeState || Boolean(setupError) || isConfirming}
          type="submit"
        >
          {isConfirming ? "Processing payment…" : "Pay order"}
        </button>
      </div>
    </form>
  );
}

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
  const [leads, setLeads] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const idempotencyKeyRef = useRef(null);

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

  async function openCreateOrder() {
    idempotencyKeyRef.current = crypto.randomUUID();
    setShowForm(true);
    setLoadingOptions(true);
    setError("");
    try {
      const [leadResult, productResult] = await Promise.all([
        getSalesLeads(),
        getWarehouseStock(),
      ]);
      if (!Array.isArray(leadResult) || !Array.isArray(productResult)) {
        throw new Error("The API returned invalid lead or product data.");
      }
      setLeads(leadResult);
      setProducts(productResult);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoadingOptions(false);
    }
  }

  async function submitOrder(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const salesId = Number(user.id);
    const leadId = String(form.get("leadId") || "").trim();
    const productId = String(form.get("productId") || "").trim();
    const quantity = Number(form.get("quantity"));
    if (!leads.some((lead) => lead.id === leadId)) {
      setError("Select a valid lead.");
      return;
    }
    if (!products.some((product) => product.id === productId)) {
      setError("Select a valid product.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantity must be a positive whole number.");
      return;
    }
    if (!Number.isInteger(salesId) || salesId < 1) {
      setError("The signed-in account does not have a valid sales ID.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payment = await createSalesOrder({
        salesId,
        leadId,
        orderItems: [{ productId, quantity }],
      }, idempotencyKeyRef.current);
      idempotencyKeyRef.current = null;
      setShowForm(false);
      if (payment.alreadyPaid) {
        setNotice("Order payment was already completed.");
      } else if (payment.clientSecret && payment.stripeAccountId) {
        setCheckout(payment);
      } else {
        throw new Error("The order was created but Stripe did not return payment details.");
      }
      await loadOrders();
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  async function handlePayOrder(orderId) {
    setProcessingId(orderId);
    setError("");
    setNotice("");
    try {
      const payment = await getOrderPaymentIntent(orderId);
      if (payment.alreadyPaid) {
        setNotice("Order payment was already completed.");
        await loadOrders();
      } else if (payment.clientSecret && payment.stripeAccountId) {
        setCheckout(payment);
      } else {
        throw new Error("Stripe did not return payment details for this order.");
      }
    } catch (paymentError) {
      setError(getErrorMessage(paymentError));
    } finally {
      setProcessingId(null);
    }
  }

  async function handleOrderPaymentComplete(completedCheckout) {
    await confirmOrderPayment(completedCheckout.orderId);
    setCheckout(null);
    setNotice(`Order ${completedCheckout.orderId} was paid.`);
    await loadOrders();
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

  async function handleMarkDelivered(orderId) {
    setProcessingId(orderId);
    setError("");
    setNotice("");
    try {
      await deliverWarehouseOrder(orderId);
      setNotice(`Order ${orderId} was marked delivered.`);
      await loadOrders();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
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
              onClick={openCreateOrder}
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
            columns={[
              "Order",
              "Amount",
              "Status",
              "Payment",
              ...(role === "WAREHOUSE" || role === "SALES" ? [""] : []),
            ]}
            rows={orders.map((order) => ({
              id: order.id,
              cells: [
                <strong className="order-id">{order.id}</strong>,
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
                      ) : String(order.status).toUpperCase() === "PROCESS" ? (
                        <button
                          className="text-button"
                          disabled={processingId !== null}
                          onClick={() => handleMarkDelivered(order.id)}
                          type="button"
                        >
                          {processingId === order.id ? "Updating…" : "Mark delivered"}
                        </button>
                      ) : <span />,
                    ]
                  : role === "SALES"
                    ? [
                        order.payment && order.payment.status !== "SUCCESS" ? (
                          <button
                            className="text-button"
                            disabled={processingId !== null}
                            onClick={() => handlePayOrder(order.id)}
                            type="button"
                          >
                            {processingId === order.id ? "Loading…" : "Pay now"}
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
      {(showForm || checkout) && (
        <Modal
          onClose={() => {
            setShowForm(false);
            setCheckout(null);
          }}
          title={checkout ? `Pay order ${checkout.orderId}` : "Create order"}
        >
          {checkout ? (
            <StripeOrderCardForm
              checkout={checkout}
              email={user?.email}
              onCancel={() => setCheckout(null)}
              onComplete={handleOrderPaymentComplete}
            />
          ) : (
          <form className="form-stack" onSubmit={submitOrder}>
            <label>
              Lead
              <select autoFocus disabled={loadingOptions} name="leadId" required>
                <option value="">
                  {loadingOptions ? "Loading leads…" : "Select a lead"}
                </option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} · {lead.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Product
              <select disabled={loadingOptions} name="productId" required>
                <option value="">
                  {loadingOptions ? "Loading products…" : "Select a product"}
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.stock} in stock
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input min="1" name="quantity" required type="number" />
            </label>
            {!loadingOptions && leads.length === 0 && (
              <p className="form-error" role="status">
                No leads are assigned to your account.
              </p>
            )}
            {!loadingOptions && products.length === 0 && (
              <p className="form-error" role="status">
                No products are currently available.
              </p>
            )}
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
                disabled={
                  saving ||
                  loadingOptions ||
                  leads.length === 0 ||
                  products.length === 0
                }
                type="submit"
              >
                {saving ? "Creating…" : "Create order"}
              </button>
            </div>
          </form>
          )}
        </Modal>
      )}
    </>
  );
}
