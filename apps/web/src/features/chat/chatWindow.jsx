import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Icon,
  initials,
  Modal,
  PageHeading,
} from "../../components/ui/Navbar";
import { ROLE_LABELS, useAuth } from "../../context/WorkspaceContext";
import { createAdminRoom, getAdminUsers } from "../admin/adminApi";
import { getMessages, getRooms } from "./chatApi";
import MessageInput from "./messageInput";
import useWorkspaceUpdates from "../../context/useWorkspaceUpdates";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");
const EMPTY_MESSAGES = [];

function getErrorMessage(error) {
  return typeof error === "string"
    ? error
    : error?.message || "Unable to load this group.";
}

function normalizeMessage(entry) {
  return {
    id: entry.id,
    author: entry.user?.name || "Team member",
    role: ROLE_LABELS[entry.user?.role] || entry.user?.role || "",
    text: entry.text,
    time: entry.createdAt
      ? new Date(entry.createdAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      : "",
  };
}

export default function ChatWindow({ canManage = false }) {
  const { user } = useAuth();
  const workspaceVersion = useWorkspaceUpdates();
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [messageState, setMessageState] = useState({
    roomId: "",
    messages: [],
  });
  const [users, setUsers] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const activeRoom = rooms.find((room) => room.id === activeRoomId);
  const messages =
    messageState.roomId === activeRoomId
      ? messageState.messages
      : EMPTY_MESSAGES;

  useEffect(() => {
    let active = true;

    getRooms()
      .then((result) => {
        if (!Array.isArray(result?.rooms)) {
          throw new Error("The API returned invalid group data.");
        }
        if (!active) return;

        const loadedRooms = result.rooms.map((room) => ({
          ...room,
          memberIds: Array.isArray(room.memberIds) ? room.memberIds : [],
        }));
        setRooms(loadedRooms);
        setActiveRoomId((current) => current || loadedRooms[0]?.id || "");
      })
      .catch((loadError) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoadingRooms(false);
      });

    return () => {
      active = false;
    };
  }, [workspaceVersion]);

  useEffect(() => {
    if (!activeRoomId) return undefined;
    if (!API_BASE) return undefined;

    let active = true;
    Promise.resolve()
      .then(() => {
        if (!active) return undefined;
        setError("");
        setLoadingMessages(true);
        return getMessages(activeRoomId);
      })
      .then((result) => {
        if (active && result) {
          setMessageState({
            roomId: activeRoomId,
            messages: Array.isArray(result) ? result.map(normalizeMessage) : [],
          });
        }
      })
      .catch((loadError) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });

    const socket = io(API_BASE, { withCredentials: true });
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("join_room", activeRoomId));
    socket.on("receive_message", (entry) => {
      if (active) {
        setMessageState((current) =>
          current.roomId === activeRoomId
            ? {
                ...current,
                messages: [...current.messages, normalizeMessage(entry)],
              }
            : current,
        );
      }
    });
    socket.on("room_error", (message) => {
      if (active) setError(String(message));
    });
    socket.on("connect_error", (connectError) => {
      if (active) setError(getErrorMessage(connectError));
    });

    return () => {
      active = false;
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [activeRoomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function openCreateForm() {
    setError("");
    setLoadingUsers(true);
    try {
      const allUsers = await getAdminUsers();
      setUsers(Array.isArray(allUsers) ? allUsers : []);
      setShowCreateForm(true);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleCreateGroup(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const groupName = String(form.get("groupName") || "").trim();
    const memberIds = Array.from(
      formElement.elements.memberIds.selectedOptions,
      (option) => Number(option.value),
    );
    if (memberIds.length === 0) {
      setError("Add at least one team member to create a group.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const room = await createAdminRoom(groupName, memberIds);
      setMessageState({ roomId: room.id, messages: [] });
      setRooms((current) => [
        { ...room, name: room.name || groupName, memberIds },
        ...current,
      ]);
      setActiveRoomId(room.id);
      setShowCreateForm(false);
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  function sendMessage(text) {
    const socket = socketRef.current;
    if (!activeRoomId || !socket?.connected) {
      setError("Chat is not connected. Try again in a moment.");
      return;
    }
    setError("");
    setSending(true);
    socket.emit("send_message", { roomId: activeRoomId, text });
    setSending(false);
  }

  return (
    <>
      <PageHeading
        title="Team chat"
        action={
          canManage ? (
            <button
              className="button button-primary"
              disabled={loadingUsers}
              onClick={openCreateForm}
              type="button"
            >
              <Icon name="plus" size={17} />
              {loadingUsers ? "Loading…" : "Create group"}
            </button>
          ) : null
        }
      />
      {(error || (!API_BASE && activeRoomId)) && (
        <div className="inline-notice error-notice" role="alert">
          <Icon name="close" size={17} />
          <span>{error || "VITE_API_URL must be configured to use chat."}</span>
          <button
            aria-label="Dismiss error"
            className="icon-button"
            onClick={() => setError("")}
            type="button"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {loadingRooms ? (
        <div className="empty-state" role="status">
          Loading group chats…
        </div>
      ) : rooms.length === 0 ? (
        <section className="panel chat-empty-state">
          <Icon name="users" size={26} />
          <p>
            {canManage
              ? "Create a group and add team members to start chatting."
              : "No group chats are available. Ask an admin to add you to a group."}
          </p>
        </section>
      ) : (
        <section className="panel chat-panel">
          <div className="chat-room-picker">
            <label htmlFor="chat-room">Group</label>
            <select
              id="chat-room"
              onChange={(event) => setActiveRoomId(event.target.value)}
              value={activeRoomId}
            >
              <option value="">Select a group</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
          {activeRoom ? (
            <>
              <div className="chat-header">
                <div className="room-avatar">
                  <Icon name="users" size={20} />
                </div>
                <div>
                  <strong>{activeRoom.name}</strong>
                  <span>{activeRoom.memberIds.length} members</span>
                </div>
              </div>
              <div aria-live="polite" className="chat-messages">
                {loadingMessages ? (
                  <div className="empty-state" role="status">
                    Loading messages…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="empty-state">No messages yet.</div>
                ) : (
                  messages.map((entry) => (
                    <div
                      className={`chat-message ${entry.author === user.name ? "chat-message-own" : ""}`}
                      key={entry.id}
                    >
                      <div className="avatar avatar-small avatar-purple">
                        {initials(entry.author)}
                      </div>
                      <div className="chat-message-content">
                        <div className="chat-message-meta">
                          <strong>{entry.author}</strong>
                          <span>{entry.role}</span>
                          <time>{entry.time}</time>
                        </div>
                        <p>{entry.text}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              <MessageInput
                disabled={sending || loadingMessages}
                onSend={sendMessage}
              />
            </>
          ) : (
            <div className="empty-state">Select a group.</div>
          )}
        </section>
      )}
      {showCreateForm && (
        <Modal
          onClose={() => setShowCreateForm(false)}
          title="Create group"
        >
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
                    {member.name} · {ROLE_LABELS[member.role] || member.role}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button
                className="button button-secondary"
                onClick={() => setShowCreateForm(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={saving || users.length === 0}
                type="submit"
              >
                {saving ? "Creating…" : "Create group"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
