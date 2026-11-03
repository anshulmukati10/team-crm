import { useCallback, useEffect, useState } from "react";
import { DataTable, Icon, PageHeading, StatusBadge } from "../../components/ui/Navbar";
import { createCompanyMember, getCompanyMembers } from "./companyApi";

const memberRoles = [
  { value: "SALES", label: "Sales" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "ACCOUNTS", label: "Accounts" },
  { value: "ADMIN", label: "Administrator" },
];

export default function CompanyTeam() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: memberRoles[0].value,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [memberState, setMemberState] = useState({ status: "loading" });

  const loadMembers = useCallback(async () => {
    setMemberState({ status: "loading" });
    try {
      const result = await getCompanyMembers();
      setMemberState({ status: "success", ...result });
    } catch (loadError) {
      setMemberState({ status: "error", error: loadError.message });
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadMembers);
  }, [loadMembers]);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const member = await createCompanyMember(form);
      setNotice(
        `${member.name || form.name} was added to ${memberRoles.find((role) => role.value === form.role)?.label || "the"} team.`,
      );
      setForm({ name: "", email: "", role: memberRoles[0].value });
      await loadMembers();
    } catch (createError) {
      setError(createError.message || "Unable to create the team member.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Company administration"
        title="Team members"
        description={
          memberState.status === "success"
            ? `${memberState.total} team member${memberState.total === 1 ? "" : "s"} in your company.`
            : "Create company team accounts and assign their workspace role."
        }
      />
      {error && (
        <div className="inline-notice" role="alert">
          <span className="notice-icon">
            <Icon name="bell" size={17} />
          </span>
          <div>
            <strong>Could not add member</strong>
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
            <strong>Team member created</strong>
            <span>{notice}</span>
          </div>
        </div>
      )}
      <section className="panel company-form-panel">
        <div className="panel-heading">
          <div>
            <h2>Add a team member</h2>
            <p>Set up an account for someone in your company.</p>
          </div>
          <span className="company-panel-icon">
            <Icon name="users" size={20} />
          </span>
        </div>
        <form className="company-form" onSubmit={handleSubmit}>
          <label className="input-group" htmlFor="member-name">
            <span>Full name</span>
            <input
              autoComplete="name"
              disabled={isSaving}
              id="member-name"
              name="name"
              onChange={handleChange}
              required
              value={form.name}
            />
          </label>
          <label className="input-group" htmlFor="member-email">
            <span>Email address</span>
            <input
              autoComplete="email"
              disabled={isSaving}
              id="member-email"
              name="email"
              onChange={handleChange}
              required
              type="email"
              value={form.email}
            />
          </label>
          <label className="input-group" htmlFor="member-role">
            <span>Workspace role</span>
            <select
              disabled={isSaving}
              id="member-role"
              name="role"
              onChange={handleChange}
              value={form.role}
            >
              {memberRoles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <div className="company-form-footer">
            <p>
              Available member capacity is controlled by your active plan.
            </p>
            <button
              className="button button-primary"
              disabled={isSaving}
              type="submit"
            >
              <Icon name="plus" size={16} />
              {isSaving ? "Creating account…" : "Create team account"}
            </button>
          </div>
        </form>
      </section>
      <section className="panel table-panel company-team-directory">
        <div className="table-toolbar">
          <div>
            <h2>Company directory</h2>
            <p>
              {memberState.status === "success"
                ? `${memberState.total} member${memberState.total === 1 ? "" : "s"}`
                : "Members assigned to this company."}
            </p>
          </div>
          <button
            className="button button-secondary"
            disabled={memberState.status === "loading"}
            onClick={loadMembers}
            type="button"
          >
            <Icon name="clock" size={16} /> Refresh
          </button>
        </div>
        {memberState.status === "loading" ? (
          <div className="empty-state" role="status">
            Loading company members…
          </div>
        ) : memberState.status === "error" ? (
          <div className="empty-state" role="alert">
            <p>{memberState.error}</p>
            <button
              className="button button-secondary"
              onClick={loadMembers}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : (
          <DataTable
            columns={["Name", "Email", "Workspace role"]}
            emptyMessage="No team members have been added to this company yet."
            rows={memberState.members.map((member) => ({
              id: member.id,
              cells: [
                <strong>{member.name}</strong>,
                <span>{member.email}</span>,
                <StatusBadge
                  status={
                    memberRoles.find((role) => role.value === member.role)
                      ?.label || member.role
                  }
                />,
              ],
            }))}
          />
        )}
      </section>
    </>
  );
}
