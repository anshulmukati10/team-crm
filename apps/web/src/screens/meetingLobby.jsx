import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { FiArrowRight, FiCheck, FiCopy, FiLink, FiPlus, FiVideo } from "react-icons/fi";
import { PageHeading } from "../components/ui/Navbar";
import { useAuth } from "../context/WorkspaceContext";
import { meetingSocket } from "../features/meeting/meetingSocket";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

function connectToMeetingService() {
  if (!API_BASE) {
    return Promise.reject(
      new Error("Set VITE_API_URL to your API server to start or join a meeting."),
    );
  }

  if (meetingSocket.connected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let timeout;
    const cleanUp = () => {
      window.clearTimeout(timeout);
      meetingSocket.off("connect", handleConnect);
      meetingSocket.off("connect_error", handleError);
    };
    const handleConnect = () => {
      cleanUp();
      resolve();
    };
    const handleError = (error) => {
      cleanUp();
      reject(new Error(error.message || "Could not connect to the meeting service."));
    };

    meetingSocket.once("connect", handleConnect);
    meetingSocket.once("connect_error", handleError);
    timeout = window.setTimeout(() => {
      cleanUp();
      reject(new Error("The meeting service did not respond. Please try again."));
    }, 10000);
    meetingSocket.connect();
  });
}

function emitWithAck(eventName) {
  return new Promise((resolve, reject) => {
    meetingSocket.timeout(10000).emit(eventName, (timeoutError, response) => {
      if (timeoutError) {
        reject(new Error("The meeting service did not respond. Please try again."));
      } else if (!response?.ok) {
        reject(new Error(response?.message || "The meeting could not be created."));
      } else {
        resolve(response);
      }
    });
  });
}

export default function MeetingLobby() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [meetingId, setMeetingId] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleConnectError = (connectionError) => {
      setError(connectionError.message || "Could not connect to the meeting service.");
      setIsStarting(false);
    };

    meetingSocket.on("connect_error", handleConnectError);
    return () => meetingSocket.off("connect_error", handleConnectError);
  }, []);

  async function startMeeting() {
    if (isStarting) return;

    setError("");
    setIsStarting(true);

    try {
      await connectToMeetingService();
      const response = await emitWithAck("meeting:create");
      navigate(`/meetings/${encodeURIComponent(response.meetingId)}`);
    } catch (meetingError) {
      setError(meetingError.message);
      setIsStarting(false);
    }
  }

  function joinMeeting(event) {
    event.preventDefault();
    const value = meetingId.trim().replace(/\/+$/, "").split("/").pop();

    if (!value) {
      setError("Enter a meeting link or ID to join.");
      return;
    }

    setError("");
    navigate(`/meetings/${encodeURIComponent(value)}`);
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meetings`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (copyError) {
      console.error("Unable to copy the meeting link:", copyError);
      setError("Your browser could not copy the meeting link. Copy it from the address bar instead.");
    }
  }

  return (
    <div className="meeting-lobby">
      <PageHeading
        eyebrow="Team collaboration"
        title="Meetings"
        description="Bring your team together with quick, face-to-face conversations."
      />

      {error && (
        <div className="meeting-alert" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")} type="button">
            ×
          </button>
        </div>
      )}

      <section className="meeting-welcome">
        <div className="meeting-welcome-copy">
          <span className="meeting-kicker"><span /> YOUR TEAM, IN THE SAME ROOM</span>
          <h2>Good conversations<br />move work forward.</h2>
          <p>Start a video meeting in seconds, or join a teammate with their meeting link.</p>
          <button
            className="meeting-primary-action"
            disabled={isStarting}
            onClick={startMeeting}
            type="button"
          >
            <FiVideo size={18} />
            {isStarting ? "Starting your meeting…" : "Start a meeting"}
            {!isStarting && <FiArrowRight size={17} />}
          </button>
          <div className="meeting-safety-note">
            <span className="meeting-live-dot" />
            Private to your Team CRM workspace
          </div>
        </div>
        <div className="meeting-illustration" aria-hidden="true">
          <div className="meeting-illustration-orbit orbit-one" />
          <div className="meeting-illustration-orbit orbit-two" />
          <div className="meeting-illustration-card">
            <div className="illustration-person illustration-person-one">S</div>
            <div className="illustration-person illustration-person-two">J</div>
            <div className="illustration-person illustration-person-three">{user.name?.[0] || "Y"}</div>
            <div className="illustration-controls">
              <span><FiVideo size={13} /></span>
              <span><FiPlus size={13} /></span>
              <span className="illustration-end"><FiArrowRight size={13} /></span>
            </div>
          </div>
          <span className="meeting-sparkle sparkle-one">✦</span>
          <span className="meeting-sparkle sparkle-two">✳</span>
        </div>
      </section>

      <section className="meeting-options" aria-label="Meeting options">
        <article className="meeting-option-card">
          <div className="meeting-option-icon meeting-option-blue"><FiPlus size={19} /></div>
          <div className="meeting-option-copy">
            <h3>Start an instant meeting</h3>
            <p>Create a room and invite your teammates with a shareable link.</p>
          </div>
          <button
            aria-label="Start a new meeting"
            className="meeting-option-arrow"
            disabled={isStarting}
            onClick={startMeeting}
            type="button"
          >
            <FiArrowRight size={17} />
          </button>
        </article>
        <article className="meeting-option-card">
          <div className="meeting-option-icon meeting-option-violet"><FiLink size={18} /></div>
          <div className="meeting-option-copy">
            <h3>Join with a link</h3>
            <p>Paste a meeting ID or link to jump into a room.</p>
            <form className="meeting-join-form" onSubmit={joinMeeting}>
              <label className="visually-hidden" htmlFor="meeting-id">Meeting link or ID</label>
              <input
                autoComplete="url"
                id="meeting-id"
                onChange={(event) => setMeetingId(event.target.value)}
                placeholder="Paste meeting link or ID"
                value={meetingId}
              />
              <button aria-label="Join meeting" type="submit"><FiArrowRight size={17} /></button>
            </form>
          </div>
        </article>
      </section>

      <section className="meeting-bottom-row">
        <div className="meeting-tip">
          <div className="meeting-tip-icon"><FiCheck size={17} /></div>
          <div>
            <strong>Ready when you are</strong>
            <p>Your camera and microphone permissions are requested when you enter a room.</p>
          </div>
        </div>
        <button className="meeting-copy-link" onClick={copyInviteLink} type="button">
          {copied ? <FiCheck size={15} /> : <FiCopy size={15} />}
          {copied ? "Link copied" : "Copy meeting page link"}
        </button>
      </section>
    </div>
  );
}
