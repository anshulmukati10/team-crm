import { useEffect, useState } from "react";
import { Icon, Modal } from "../../components/ui/Navbar";
import { ROLE_LABELS as WORKSPACE_ROLE_LABELS, useAuth } from "../../context/WorkspaceContext";
import { createAdminRoom, getAdminUsers, removeAdminRoomMember } from "../admin/adminApi";
import { dispatchWorkspaceUpdate } from "../../context/useWorkspaceUpdates";
import { addMember, getRooms } from "./chatApi";
import ChatWindow from "./chatWindow";

function errorMessage(error) {
  return typeof error === "string" ? error : error?.message || "Unable to update this group.";
}

export default function AdminChatController() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [memberToAdd, setMemberToAdd] = useState("");
  const [memberToRemove, setMemberToRemove] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadManagementData() {
    setLoading(true);
    setError("");
    try {
      const [roomData, allUsers] = await Promise.all([getRooms(), getAdminUsers()]);
      const availableRooms = Array.isArray(roomData?.rooms) ? roomData.rooms : [];
      setRooms(availableRooms);
      setUsers(Array.isArray(allUsers) ? allUsers : []);
      setSelectedRoomId((current) => current || availableRooms[0]?.id || "");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    Promise.all([getRooms(), getAdminUsers()])
      .then(([roomData, allUsers]) => {
        if (!active) return;
        const availableRooms = Array.isArray(roomData?.rooms) ? roomData.rooms : [];
        setRooms(availableRooms);
        setUsers(Array.isArray(allUsers) ? allUsers : []);
        setSelectedRoomId((current) => current || availableRooms[0]?.id || "");
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError));
      });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  async function handleCreateGroup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const groupName = String(new FormData(form).get("groupName") || "").trim();
    const memberIds = Array.from(form.elements.memberIds.selectedOptions, ({ value }) => Number(value));

    if (!groupName) return;
    setLoading(true);
    setError("");
    try {
      await createAdminRoom(groupName, memberIds);
      setShowCreateForm(false);
      await loadManagementData();
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember() {
    if (!selectedRoomId || !memberToAdd) return;
    setLoading(true);
    setError("");
    try {
      const addedUserId = Number(memberToAdd);
      await addMember({ roomId: selectedRoomId, userId: addedUserId });
      setRooms((current) => current.map((room) =>
        String(room.id) === String(selectedRoomId)
          ? {
              ...room,
              memberIds: [...new Set([...(room.memberIds || []).map(Number), addedUserId])],
            }
          : room,
      ));
      const roomData = await getRooms();
      if (Array.isArray(roomData?.rooms)) {
        setRooms(roomData.rooms.map((room) => ({
          ...room,
          memberIds: Array.isArray(room.memberIds)
            ? room.memberIds.map(Number)
            : [],
        })));
      }
      setMemberToAdd("");
      dispatchWorkspaceUpdate();
    } catch (addError) {
      setError(errorMessage(addError));
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveMember() {
    if (!selectedRoomId || !memberToRemove) return;
    setLoading(true);
    setError("");
    try {
      const removedUserId = Number(memberToRemove);
      await removeAdminRoomMember(selectedRoomId, removedUserId);
      setRooms((current) => current.map((room) =>
        String(room.id) === String(selectedRoomId)
          ? { ...room, memberIds: [...new Set((room.memberIds || []).map(Number).filter((id) => id !== removedUserId))] }
          : room,
      ));
      setMemberToRemove("");
      dispatchWorkspaceUpdate();
    } catch (removeError) {
      setError(errorMessage(removeError));
    } finally {
      setLoading(false);
    }
  }

  const selectedRoom = rooms.find((room) => String(room.id) === String(selectedRoomId));
  const memberIds = Array.isArray(selectedRoom?.memberIds)
    ? selectedRoom.memberIds.map(Number)
    : [];
  return (
    <div className="space-y-5">
      {isAdmin && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0">
              <h2 className="m-0 text-base font-semibold text-slate-800">
                Group administration
              </h2>
              <p className="mb-0 mt-1 text-sm leading-5 text-slate-500">
                Create groups and manage who can participate in each chat.
              </p>
            </div>
            <button
              className="button button-primary w-full shrink-0 sm:w-auto"
              disabled={loading}
              onClick={() => setShowCreateForm(true)}
              type="button"
            >
              <Icon name="plus" size={17} />
              Create group
            </button>
          </div>
          {error && (
            <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 sm:mx-6">
              <Icon className="mt-0.5 shrink-0" name="close" size={16} />
              <span role="alert">{error}</span>
            </div>
          )}
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
            <div className="grid content-start gap-3 rounded-lg border border-slate-200 p-4">
              <h3 className="m-0 text-sm font-semibold text-slate-700">
                Add a member
              </h3>
              <label
                className="grid gap-1.5 text-xs font-medium text-slate-600"
                htmlFor="admin-chat-add-room"
              >
                Group
              </label>
              <select
                className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                disabled={loading || !rooms.length}
                id="admin-chat-add-room"
                value={selectedRoomId}
                onChange={(event) => {
                  setSelectedRoomId(event.target.value);
                  setMemberToRemove("");
                }}
              >
                <option value="">Select a group</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
              <label
                className="grid gap-1.5 text-xs font-medium text-slate-600"
                htmlFor="admin-chat-add-member"
              >
                User
              </label>
              <select
                className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                disabled={loading || !selectedRoom || !users.length}
                id="admin-chat-add-member"
                value={memberToAdd}
                onChange={(event) => setMemberToAdd(event.target.value)}
              >
                <option value="">Select a user to add</option>
                {users
                  .filter(
                    (user) =>
                      !memberIds.some(
                        (memberId) => memberId === Number(user.id),
                      ),
                  )
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ·{" "}
                      {WORKSPACE_ROLE_LABELS[user.role] || user.role}
                    </option>
                  ))}
              </select>
              <button
                className="button button-secondary mt-1 w-full sm:w-auto sm:justify-self-start"
                disabled={loading || !selectedRoomId || !memberToAdd}
                onClick={handleAddMember}
                type="button"
              >
                <Icon name="plus" size={16} />
                Add member
              </button>
            </div>

            <div className="grid content-start gap-3 rounded-lg border border-slate-200 p-4">
              <h3 className="m-0 text-sm font-semibold text-slate-700">
                Remove a member
              </h3>
              <label
                className="grid gap-1.5 text-xs font-medium text-slate-600"
                htmlFor="admin-chat-remove-room"
              >
                Group
              </label>
              <select
                className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                disabled={loading || !rooms.length}
                id="admin-chat-remove-room"
                value={selectedRoomId}
                onChange={(event) => {
                  setSelectedRoomId(event.target.value);
                  setMemberToRemove("");
                }}
              >
                <option value="">Select a group</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
              <label
                className="grid gap-1.5 text-xs font-medium text-slate-600"
                htmlFor="admin-chat-remove-member"
              >
                Member
              </label>
              <select
                className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                disabled={loading || !memberIds.length}
                id="admin-chat-remove-member"
                value={memberToRemove}
                onChange={(event) => setMemberToRemove(event.target.value)}
              >
                <option value="">Select a member to remove</option>
                {memberIds.map((memberId) => {
                  const member = users.find(
                    (user) => Number(user.id) === Number(memberId),
                  );
                  return (
                    <option key={memberId} value={memberId}>
                      {member?.name || `User ${memberId}`}
                    </option>
                  );
                })}
              </select>
              <button
                className="button button-secondary mt-1 w-full text-red-700 hover:border-red-200 hover:bg-red-50 sm:w-auto sm:justify-self-start"
                disabled={loading || !selectedRoomId || !memberToRemove}
                onClick={handleRemoveMember}
                type="button"
              >
                Remove member
              </button>
            </div>
          </div>
        </section>
      )}
      <ChatWindow canManage={false} />
      {showCreateForm && (
        <Modal onClose={() => setShowCreateForm(false)} title="Create group">
          <form className="form-stack" onSubmit={handleCreateGroup}>
            <label>
              Group name
              <input autoFocus maxLength="80" name="groupName" required />
            </label>
            <label>
              Add members
              <select
                multiple
                name="memberIds"
                required
                size={Math.min(Math.max(users.length, 2), 6)}
              >
                {users.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {WORKSPACE_ROLE_LABELS[member.role] || member.role}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button className="button button-secondary" onClick={() => setShowCreateForm(false)} type="button">Cancel</button>
              <button className="button button-primary" disabled={loading} type="submit">Create group</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
