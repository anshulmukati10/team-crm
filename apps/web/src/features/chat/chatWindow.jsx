import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Icon,
  initials,
  Modal,
  PageHeading,
} from "../../components/ui/Navbar";
import { ROLE_LABELS, useAuth } from "../../context/WorkspaceContext";
import { getMessages, getRooms } from "./chatApi";
import MessageInput from "./messageInput";
import useWorkspaceUpdates from "../../context/useWorkspaceUpdates";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");
const EMPTY_MESSAGES = [];
const EMPTY_RECEIPTS = [];

function getErrorMessage(error) {
  return typeof error === "string"
    ? error
    : error?.message || "Unable to load this group.";
}

function normalizeMessage(entry, delivered = true) {
  return {
    id: entry.id,
    author: entry.user?.name || "Team member",
    role: ROLE_LABELS[entry.user?.role] || entry.user?.role || "",
    text: entry.text,
    senderId: entry.userId,
    clientMessageId: entry.clientMessageId,
    delivered,
    time: entry.createdAt
      ? new Date(entry.createdAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      : "",
  };
}

function MessageTicks({ delivered, readByAll }) {
  const color = readByAll
    ? "text-blue-700"
    : delivered
      ? "text-slate-400"
      : "text-slate-300";
  const label = readByAll
    ? "Read by everyone"
    : delivered
      ? "Delivered"
      : "Sent";

  return (
    <svg
      aria-label={label}
      className={`inline-block shrink-0 ${color}`}
      fill="none"
      height="16"
      role="img"
      viewBox="0 0 24 16"
      width={delivered ? "22" : "14"}
    >
      {delivered ? (
        <path
          d="m1.5 8 4.2 4.2L15 3M8.5 8l4.2 4.2L22 3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      ) : (
        <path
          d="m2 8 4.2 4.2L16 3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

function formatSeenAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [messageInfoId, setMessageInfoId] = useState("");
  const [receiptState, setReceiptState] = useState({ roomId: "", receipts: [] });
  const receipts = receiptState.roomId === activeRoomId
    ? receiptState.receipts
    : EMPTY_RECEIPTS;
  const seenMessageIdsRef = useRef(new Set());
  const visibleObserverRef = useRef(null);
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
            messages: Array.isArray(result)
              ? result.map((entry) => normalizeMessage(entry))
              : [],
          });
        }
      })
      .catch((loadError) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });

    seenMessageIdsRef.current.clear();
    const socket = io(API_BASE, { withCredentials: true });
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("join_room", activeRoomId));
    socket.on("receive_message", (entry) => {
      if (active) {
        const receivedMessage = normalizeMessage(entry);
        setMessageState((current) =>
          current.roomId === activeRoomId
            ? {
                ...current,
                messages: entry.clientMessageId &&
                  current.messages.some(
                    (message) =>
                      message.clientMessageId === entry.clientMessageId,
                  )
                    ? current.messages.map((message) =>
                        message.clientMessageId === entry.clientMessageId
                          ? receivedMessage
                          : message,
                      )
                    : [...current.messages, receivedMessage],
              }
            : current,
        );
      }
    });
    socket.on("receipts_sync", (sync) => {
      if (active && String(sync.roomId) === String(activeRoomId)) {
        setReceiptState({
          roomId: activeRoomId,
          receipts: Array.isArray(sync.receipts) ? sync.receipts : [],
        });
      }
    });
    socket.on("receipts_updated", (update) => {
      if (active && String(update.roomId) === String(activeRoomId)) {
        setReceiptState({
          roomId: activeRoomId,
          receipts: Array.isArray(update.receipts) ? update.receipts : [],
        });
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

  useEffect(() => {
    if (!activeRoomId || !socketRef.current) return undefined;
    if (!("IntersectionObserver" in window)) return undefined;

    visibleObserverRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleIds = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.6)
          .map((entry) => entry.target.dataset.messageId)
          .filter(Boolean);

        if (!visibleIds.length) return;
        const visibleId = visibleIds[visibleIds.length - 1];
        if (seenMessageIdsRef.current.has(visibleId)) return;
        seenMessageIdsRef.current.add(visibleId);
        socketRef.current?.emit("mark_message_seen", {
          roomId: activeRoomId,
          messageId: visibleId,
        });
      },
      { threshold: 0.6 },
    );
    visibleObserverRef.current = observer;
    document.querySelectorAll("[data-chat-message-id]").forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [activeRoomId, messages]);

  function seenByForMessage(messageId) {
    const messageRank = messages.findIndex((message) => message.id === messageId) + 1;
    if (messageRank < 1) return [];
    return receipts
      .filter((receipt) =>
        Number(receipt.userId) !== Number(user.id) &&
        Number(receipt.rank) >= messageRank
      )
      .map((receipt) => ({
        userId: Number(receipt.userId),
        name: receipt.name,
        seenAt: formatSeenAt(receipt.seenAt),
      }));
  }

  function hasBeenReadByEveryone(viewers) {
    const otherMemberIds = (activeRoom?.memberIds || []).filter(
      (memberId) => Number(memberId) !== Number(user.id),
    );
    return (
      otherMemberIds.length > 0 &&
      otherMemberIds.every((memberId) =>
        viewers.some((viewer) => viewer.userId === Number(memberId)),
      )
    );
  }

  function sendMessage(text) {
    const socket = socketRef.current;
    if (!activeRoomId || !socket?.connected) {
      setError("Chat is not connected. Try again in a moment.");
      return;
    }
    setError("");
    setSending(true);
    const clientMessageId = crypto.randomUUID();
    const pendingMessage = {
      id: clientMessageId,
      clientMessageId,
      author: user.name || "Team member",
      role: ROLE_LABELS[user.role] || user.role || "",
      text,
      senderId: user.id,
      time: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
      delivered: false,
    };
    setMessageState((current) =>
      current.roomId === activeRoomId
        ? { ...current, messages: [...current.messages, pendingMessage] }
        : current,
    );
    socket.timeout(10000).emit(
      "send_message",
      { roomId: activeRoomId, text, clientMessageId },
      (timeoutError, response) => {
        setSending(false);
        if (timeoutError || !response?.success) {
          setMessageState((current) =>
            current.roomId === activeRoomId
              ? {
                  ...current,
                  messages: current.messages.filter(
                    (message) => message.clientMessageId !== clientMessageId,
                  ),
                }
              : current,
          );
          setError(
            response?.message || "Message could not be sent. Please try again.",
          );
          return;
        }
        setMessageState((current) =>
          current.roomId === activeRoomId
            ? {
                ...current,
                messages: current.messages.map((message) =>
                  message.clientMessageId === clientMessageId
                    ? { ...message, delivered: true }
                    : message,
                ),
              }
            : current,
        );
      },
    );
  }

  return (
    <>
      <PageHeading title="Team chat" />
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
                      data-chat-message-id={entry.id}
                      key={entry.id}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setMessageInfoId(entry.id);
                      }}
                      title="Right-click to view message info"
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
                        {Number(entry.senderId) === Number(user.id) && (
                          <div className="mt-1 flex justify-end">
                            <MessageTicks
                              delivered={entry.delivered}
                              readByAll={hasBeenReadByEveryone(
                                seenByForMessage(entry.id),
                              )}
                            />
                          </div>
                        )}
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
      {messageInfoId && (
        <Modal
          description="Read receipts for this message"
          onClose={() => setMessageInfoId("")}
          title="Message info"
        >
          <div className="grid gap-3 px-5 py-4">
            <p className="m-0 text-sm text-slate-500">
              {messages.find((message) => message.id === messageInfoId)?.text}
            </p>
            <h3 className="m-0 text-sm font-semibold text-slate-700">
              Seen by
            </h3>
            {seenByForMessage(messageInfoId).length > 0 ? (
              <ul className="m-0 grid list-none gap-2 p-0">
                {seenByForMessage(messageInfoId).map((viewer) => (
                  <li
                    className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                    key={viewer.userId}
                  >
                    <span className="font-medium text-slate-700">
                      {viewer.name || "Team member"}
                    </span>
                    <span className="text-right text-xs text-slate-500">
                      {viewer.seenAt || "Seen"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
                No one has seen this message yet.
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
