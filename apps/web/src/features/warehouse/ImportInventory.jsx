import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DataTable,
  formatCurrency,
  Icon,
  Modal,
  PageHeading,
} from "../../components/ui/Navbar";
import { useAuth } from "../../context/WorkspaceContext";
import { createAdminProduct } from "../admin/adminApi";
import { getWarehouseStock } from "./wareHouseApi";
import useWorkspaceUpdates from "../../context/useWorkspaceUpdates";

function getErrorMessage(error) {
  return typeof error === "string"
    ? error
    : error?.message || "Unable to load inventory.";
}

export default function Inventory() {
  const { role } = useAuth();
  const workspaceVersion = useWorkspaceUpdates();
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    setError("");
    try {
      const result = await getWarehouseStock();
      if (!Array.isArray(result)) throw new Error("Invalid inventory response.");
      setProducts(result);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadProducts);
  }, [loadProducts, workspaceVersion]);

  const visibleProducts = useMemo(
    () =>
      products.filter((product) =>
        `${product.name} ${product.id}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [products, query],
  );
  const lowStockCount = products.filter((product) => product.stock <= 10).length;

  async function submitProduct(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      await createAdminProduct({
        name: String(form.get("name")).trim(),
        price: Number(form.get("price")),
        stock: Number(form.get("stock")),
      });
      setShowForm(false);
      await loadProducts();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading
        title="Inventory"
        description="Current product stock from the CRM."
        action={
          role === "ADMIN" ? (
            <button
              className="button button-primary"
              onClick={() => setShowForm(true)}
              type="button"
            >
              <Icon name="plus" size={17} /> Add product
            </button>
          ) : null
        }
      />
      {error && (
        <div className="inline-notice error-notice" role="alert">
          <Icon name="close" size={17} />
          <span>{error}</span>
        </div>
      )}
      <section className="inventory-summary">
        <div>
          <span className="summary-label">Catalog products</span>
          <strong>{products.length}</strong>
        </div>
        <div>
          <span className="summary-label">Units in stock</span>
          <strong>
            {products.reduce((sum, product) => sum + Number(product.stock || 0), 0)}
          </strong>
        </div>
        <div>
          <span className="summary-label">Items to reorder</span>
          <strong className="warning-text">{lowStockCount}</strong>
        </div>
        <div>
          <span className="summary-label">Inventory value</span>
          <strong>
            {formatCurrency(
              products.reduce(
                (sum, product) =>
                  sum + Number(product.stock || 0) * Number(product.price || 0),
                0,
              ),
            )}
          </strong>
        </div>
      </section>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div>
            <h2>Product catalog</h2>
          </div>
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="Search inventory"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products..."
              value={query}
            />
          </label>
        </div>
        {loading ? (
          <div className="empty-state" role="status">Loading inventory…</div>
        ) : (
          <DataTable
            columns={["Product", "Product ID", "In stock", "Unit price", "Stock status"]}
            rows={visibleProducts.map((product) => ({
              id: product.id,
              cells: [
                <div className="product-cell">
                  <span className="product-thumb">
                    <Icon name="package" size={20} />
                  </span>
                  <strong>{product.name}</strong>
                </div>,
                <span className="sku-text">{product.id}</span>,
                <strong>{product.stock} units</strong>,
                <span>{formatCurrency(Number(product.price || 0))}</span>,
                product.stock <= 10 ? (
                  <span className="stock-warning"><span /> Low stock</span>
                ) : (
                  <span className="stock-ok"><span /> In stock</span>
                ),
              ],
            }))}
            emptyMessage="No products match your search."
          />
        )}
        <div className="table-bottom">
          <span>
            Showing <strong>{visibleProducts.length}</strong> of{" "}
            <strong>{products.length}</strong> products
          </span>
        </div>
      </section>
      {showForm && (
        <Modal
          onClose={() => setShowForm(false)}
          title="Add product"
        >
          <form className="form-stack" onSubmit={submitProduct}>
            <label>
              Product name
              <input autoFocus maxLength="120" name="name" required />
            </label>
            <div className="form-row">
              <label>
                Starting stock
                <input min="0" name="stock" required type="number" />
              </label>
              <label>
                Unit price
                <input min="0" name="price" required type="number" />
              </label>
            </div>
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
                {saving ? "Saving…" : "Add product"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
