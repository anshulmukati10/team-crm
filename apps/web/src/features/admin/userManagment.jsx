import { useCallback, useEffect, useState } from "react";
import {
  DataTable,
  Icon,
  PageHeading,
  StatusBadge,
} from "../../components/ui/Navbar";
import { deleteAdminUser, getAdminUsers } from "./adminApi";
import useWorkspaceUpdates from "../../context/useWorkspaceUpdates";
// import { getRooms } from "../chat/chatApi";

const roleLabels = {
  SALES: "Sales",
  WAREHOUSE: "Warehouse",
  ACCOUNTS: "Accounts",
  ADMIN: "Admin",
};

export default function UserManagement() {
  const workspaceVersion = useWorkspaceUpdates();
  const [users, setUsers] = useState([]);
  // const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  //   const loadRooms = useCallback(async () => {
  //   setLoading(true);
  //   setError("");
  //   try {
  //     const data = await getRooms();
  //     setRooms(Array.isArray(data) ? data : []);
  //   } catch (loadError) {
  //     setError(loadError.message);
  //   } finally {
  //     setLoading(false);
  //   }
  // }, []);

  useEffect(() => {
    Promise.resolve().then(loadUsers);
  }, [loadUsers, workspaceVersion]);




  async function handleDelete(user) {
    if (!window.confirm(`Remove ${user.name} from the team?`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await deleteAdminUser(user.id);
      setUsers((currentUsers) =>
        currentUsers.filter((currentUser) => currentUser.id !== user.id),
      );
      setNotice(`${user.name} was removed from the team.`);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  }

  //   async function handleCreateRoom(event) {
  //   event.preventDefault();
  //   const formElement = event.currentTarget;
  //   const form = new FormData(formElement);
  //   const groupName = String(form.get("groupName") || "").trim();
  //   const memberIds = Array.from(
  //     event.currentTarget.elements.memberIds.selectedOptions,
  //     (option) => Number(option.value),
  //   );
  //   setSaving(true);
  //   setError("");
  //   setNotice("");
  //   try {
  //     const room = await createAdminRoom(groupName, memberIds);
  //     setRooms((currentRooms) => [
  //       { ...room, memberIds },
  //       ...currentRooms,
  //     ]);
  //     setNotice(`Room "${room.name || groupName}" was created.`);
  //     formElement.reset();
  //   } catch (createError) {
  //     setError(createError.message);
  //   } finally {
  //     setSaving(false);
  //   }
  // }

  // async function handleRemoveMember(room, memberId) {
  //   const member = users.find((user) => user.id === memberId);
  //   setSaving(true);
  //   setError("");
  //   setNotice("");
  //   try {
  //     await removeAdminRoomMember(room.id, memberId);
  //     setRooms((currentRooms) =>
  //       currentRooms.map((currentRoom) =>
  //         currentRoom.id === room.id
  //           ? {
  //               ...currentRoom,
  //               memberIds: currentRoom.memberIds.filter((id) => id !== memberId),
  //               }
  //           : currentRoom,
  //       ),
  //     );
  //     setNotice(`${member?.name || "Member"} was removed from ${room.name}.`);
  //   } catch (removeError) {
  //     setError(removeError.message);
  //   } finally {
  //     setSaving(false);
  //   }
  // }

  return (
    <>
      <PageHeading
        eyebrow="Administration"
        title="Team members"
        description="Review and manage team accounts."
        action={
          <button
            className="button button-secondary"
            disabled={loading}
            onClick={loadUsers}
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
            <strong>Action failed</strong>
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
            <strong>Done</strong>
            <span>{notice}</span>
          </div>
        </div>
      )}
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div>
            <h2>Team directory</h2>
            <p>{users.length} team member{users.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        {loading ? (
          <div className="empty-state" role="status">
            Loading team members…
          </div>
        ) : (
          <DataTable
            columns={["Member", "Email", "Role", ""]}
            rows={users.map((user) => ({
              id: user.id,
              cells: [
                <strong>{user.name}</strong>,
                <span>{user.email}</span>,
                <StatusBadge status={roleLabels[user.role] || user.role} />,
                <button
                  className="button button-small button-secondary"
                  disabled={saving}
                  onClick={() => handleDelete(user)}
                  type="button"
                >
                  Remove
                </button>,
              ],
            }))}
            emptyMessage="No non-admin team members were found."
          />
        )}
      </section>

          {/* <section className="panel table-panel">
             <button
            className="button button-secondary"
            disabled={loading}
            onClick={loadRooms}
            type="button"
          >
            <Icon name="clock" size={16} /> Refresh
          </button>
        <div className="table-toolbar">
          <div>
            <h2>Groups</h2>
          </div>
        </div>
        {loading ? (
          <div className="empty-state" role="status">
            Loading rooms...
          </div>
        ) : (
          <DataTable
            columns={["Room", "CreatedAt", "Owner"]}
            rows={rooms.map((r) => ({
              id: r.id,
              cells: [
                <strong>{r.name}</strong>,
                <span>{r.createdAt}</span>,
                
                // <button
                //   className="button button-small button-secondary"
                //   disabled={saving}
                //   onClick={() => handleDelete(user)}
                //   type="button"
                // >
                //   Remove
                // </button>,
              ],
            }))}
            emptyMessage="No non-admin team members were found."
          />
        )}
      </section> */}
        
      {/* <section className="panel form-stack">
        <div className="panel-heading">
          <div>
            <h2>Create a team room</h2>
            <p>The current admin is added automatically by the server.</p>
          </div>
        </div>
        <form className="form-stack" onSubmit={handleCreateRoom}>
          <label>
            Room name
            <input
              maxLength="80"
              name="groupName"
              placeholder="e.g. Sales team"
              required
            />
          </label>
          <label>
            Initial members
            <select multiple name="memberIds" size={Math.min(Math.max(users.length, 2), 6)}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {roleLabels[user.role] || user.role}
                </option>
              ))}
            </select>
            <small>Use Ctrl (Windows) or Command (Mac) to select multiple people.</small>
          </label>
          <div>
            <button
              className="button button-primary"
              disabled={saving || users.length === 0}
              type="submit"
            >
              {saving ? "Saving…" : "Create room"}
            </button>
          </div>
        </form>
      </section> */}
      {/* {rooms.length > 0 && (
        <section className="panel table-panel">
          <div className="panel-heading">
            <div>
              <h2>Rooms created this session</h2>
              <p>Room IDs are returned by the backend and can be managed here.</p>
            </div>
          </div>
          <DataTable
            columns={["Room", "Room ID", "Member", ""]}
            rows={rooms.flatMap((room) =>
              room.memberIds.map((memberId) => {
                const member = users.find((user) => user.id === memberId);
                return {
                  id: `${room.id}-${memberId}`,
                  cells: [
                    <strong>{room.name}</strong>,
                    <span className="sku-text">{room.id}</span>,
                    <span>{member?.name || "Team member"}</span>,
                    <button
                      className="button button-small button-secondary"
                      disabled={saving}
                      onClick={() => handleRemoveMember(room, memberId)}
                      type="button"
                    >
                      Remove from room
                    </button>,
                  ],
                };
              }),
            )}
            emptyMessage="The rooms created in this session have no removable members."
          />
        </section> */}
      {/* )} */}
    </>
  );
}