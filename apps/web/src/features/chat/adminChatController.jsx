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
    <>
      {isAdmin && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Group administration</h2>
              <p>Create groups and remove members from existing groups.</p>
            </div>
            <button className="button button-primary" onClick={() => setShowCreateForm(true)} type="button">
              <Icon name="plus" size={17} /> Create group
            </button>
          </div>
          {error && <div className="inline-notice error-notice" role="alert">{error}</div>}
          <div className="form-grid">
            <label>
              Group
              <select value={selectedRoomId} onChange={(event) => {
                setSelectedRoomId(event.target.value);
                setMemberToRemove("");
              }}>
                <option value="">Select a group</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </label>
            <label>
              User to add
              <select value={memberToAdd} onChange={(event) => setMemberToAdd(event.target.value)}>
                <option value="">Select a user</option>
                {users
                  .filter((user) => !memberIds.some((memberId) => memberId === Number(user.id)))
                  .map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <button className="button button-secondary" disabled={loading || !memberToAdd} onClick={handleAddMember} type="button">
              Add member
            </button>
            <label>
              Member to remove
              <select value={memberToRemove} onChange={(event) => setMemberToRemove(event.target.value)}>
                <option value="">Select a member</option>
                {memberIds.map((memberId) => {
                  const member = users.find((user) => Number(user.id) === Number(memberId));
                  return <option key={memberId} value={memberId}>{member?.name || `User ${memberId}`}</option>;
                })}
              </select>
            </label>
            <button className="button button-secondary" disabled={loading || !memberToRemove} onClick={handleRemoveMember} type="button">
              Remove member
            </button>
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
              <select multiple name="memberIds" required size={Math.min(Math.max(users.length, 2), 6)}>
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
    </>
  );
}
