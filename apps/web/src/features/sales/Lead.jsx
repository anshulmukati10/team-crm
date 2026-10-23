import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, Icon, Modal, PageHeading, StatusBadge } from "../../components/ui/Navbar";
import { useAuth } from "../../context/WorkspaceContext";
import { createAdminLead, getAdminLeads, getAdminUsers } from "../admin/adminApi";
import { getSalesLeads } from "./salesApi";
import { getAccountSales } from "../accounts/accountApi";
import useWorkspaceUpdates from "../../context/useWorkspaceUpdates";

function getErrorMessage(error) {
  return typeof error === "string"
    ? error
    : error?.message || "Unable to load leads.";
}

async function fetchLeads(role) {
  if (role === "SALES") return getSalesLeads();
  if (role === "ACCOUNTS") {
    const sales = await getAccountSales();
    return sales.flatMap((salesUser) =>
      (salesUser.leads || []).map((lead) => ({
        ...lead,
        salesRepresentative: salesUser.name,
      })),
    );
  }
  return getAdminLeads();
}

export default function Leads() {
  const { role } = useAuth();
  const workspaceVersion = useWorkspaceUpdates();
  const [leads, setLeads] = useState([]);
  const [salesUsers, setSalesUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(role === "ADMIN");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadLeads = useCallback(async () => {
    setError("");
    try {
      const result = await fetchLeads(role);
      if (!Array.isArray(result)) throw new Error("Invalid leads response.");
      setLeads(result);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchLeads(role),
      role === "ADMIN" ? getAdminUsers() : Promise.resolve([]),
    ])
      .then(([leadResult, userResult]) => {
        if (!active) return;
        if (!Array.isArray(leadResult)) throw new Error("Invalid leads response.");
        if (!Array.isArray(userResult)) throw new Error("Invalid user data.");
        setLeads(leadResult);
        setSalesUsers(userResult.filter((member) => member.role === "SALES"));
      })
      .catch((loadError) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadLeads, role, workspaceVersion]);

  const visibleLeads = useMemo(
    () =>
      leads.filter((lead) =>
        `${lead.name} ${lead.phone} ${lead.id}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [leads, query],
  );

  async function submitLead(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      await createAdminLead({
        name: String(form.get("name")).trim(),
        phone: String(form.get("phone")).trim(),
        salesId: Number(form.get("salesId")),
      });
      setShowForm(false);
      await loadLeads();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading
        title="Leads"
        action={
          role === "ADMIN" ? (
            <button
              className="button button-primary"
              disabled={!salesUsers.length}
              onClick={() => setShowForm(true)}
              type="button"
            >
              <Icon name="plus" size={17} /> Add lead
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
        <section className="panel table-panel">
          <div className="table-toolbar">
            <div>
              <h2>
                {role === "SALES"
                  ? "My assigned leads"
                  : role === "ACCOUNTS"
                    ? "Sales leads"
                    : "All leads"}{" "}
                <span className="count-pill">{leads.length}</span>
              </h2>
            </div>
            <label className="search-field">
              <Icon name="search" size={18} />
              <input
                aria-label="Search leads"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search leads..."
                value={query}
              />
            </label>
          </div>
          {loading ? (
            <div className="empty-state" role="status">Loading leads…</div>
          ) : (
            <DataTable
              columns={[
                "Lead",
                "Phone",
                ...(role === "ACCOUNTS" ? ["Sales representative"] : []),
                "Status",
                "Lead ID",
              ]}
              rows={visibleLeads.map((lead) => ({
                id: lead.id,
                cells: [
                  <strong>{lead.name}</strong>,
                  <span>{lead.phone}</span>,
                  ...(role === "ACCOUNTS"
                    ? [<span>{lead.salesRepresentative}</span>]
                    : []),
                  <StatusBadge status={lead.status} />,
                  <span className="sku-text">{lead.id}</span>,
                ],
              }))}
              emptyMessage="No leads found."
            />
          )}
        </section>
      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="Add lead">
          <form className="form-stack" onSubmit={submitLead}>
            <label>
              Contact name
              <input autoFocus name="name" required />
            </label>
            <label>
              Phone
              <input
                maxLength="10"
                minLength="10"
                name="phone"
                pattern="[0-9]{10}"
                required
                type="tel"
              />
            </label>
            <label>
              Sales representative
              <select name="salesId" required>
                {salesUsers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
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
                {saving ? "Saving…" : "Add lead"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
