import { useState } from "react";
import { Icon } from "../../components/ui/Navbar";

export default function MessageInput({ onSend, disabled = false }) {
  const [message, setMessage] = useState("");

  function submit(event) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    onSend(text);
    setMessage("");
  }

  return (
    <>
      <form className="chat-compose" onSubmit={submit}>
        <textarea
          aria-label="Write a message"
          disabled={disabled}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form.requestSubmit();
            }
          }}
          placeholder="Message the team..."
          rows="1"
          value={message}
        />
        <button
          aria-label="Send message"
          className="send-button"
          disabled={disabled || !message.trim()}
          type="submit"
        >
          <Icon name="arrow" size={18} />
        </button>
      </form>
      <p className="chat-hint">
        Press Enter to send, Shift + Enter for a new line
      </p>
    </>
  );
}
