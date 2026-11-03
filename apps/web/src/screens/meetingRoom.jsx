import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  FiArrowLeft,
  FiCheck,
  FiCircle,
  FiCopy,
  FiMic,
  FiMicOff,
  FiMonitor,
  FiMoreHorizontal,
  FiPhoneOff,
  FiSquare,
  FiUsers,
  FiVideo,
  FiVideoOff,
} from "react-icons/fi";
import { initials } from "../components/ui/Navbar";
import { useAuth } from "../context/WorkspaceContext";
import { upload } from "../features/chat/chatApi";
import { startMeetingRecording } from "../features/meeting/meetingRecording";
import useWebRTC from "../features/meeting/webRTC";

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function VideoTile({ name, stream, isLocal = false, cameraEnabled = true }) {
  const videoRef = useRef(null);
  const hasVideo = Boolean(stream?.getVideoTracks().some((track) => track.enabled));

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <article className={`meeting-video-tile${isLocal ? " meeting-video-local" : ""}`}>
      {stream && (
        <video
          autoPlay
          className={hasVideo && cameraEnabled ? "meeting-video-visible" : ""}
          muted={isLocal}
          playsInline
          ref={videoRef}
        />
      )}
      {(!hasVideo || !cameraEnabled) && (
        <div className="meeting-video-placeholder">
          <span className={`meeting-person-avatar ${isLocal ? "avatar-self" : ""}`}>
            {initials(name) || "?"}
          </span>
          {!stream && !isLocal && <span className="meeting-connecting-label">Connecting…</span>}
        </div>
      )}
      <div className="meeting-video-caption">
        <span className="meeting-caption-name">
          {name}{isLocal ? " (you)" : ""}
        </span>
        {isLocal && !cameraEnabled && <FiVideoOff aria-label="Camera off" size={14} />}
      </div>
    </article>
  );
}

export default function MeetingRoom() {
  const { meetingId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    localStream,
    participants,
    status,
    error,
    mediaError,
    screenStream,
    startScreenShare,
    stopScreenShare,
    screenShareNotification,
  } = useWebRTC(meetingId);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingError, setRecordingError] = useState("");
  const recordingSessionRef = useRef(null);
  const recordingStartPendingRef = useRef(false);
  const mountedRef = useRef(true);

  const recordingSources = useMemo(
    () => [
      { id: "local", name: user.name || "You", stream: localStream },
      ...participants.map((participant) => ({
        id: participant.socketId,
        name: participant.name || "Team member",
        stream: participant.stream,
      })),
    ],
    [localStream, participants, user.name],
  );
  const canRecord = recordingSources.some(({ stream }) =>
    stream?.getTracks().some((track) => track.readyState === "live"),
  );

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setElapsedSeconds((current) => current + 1),
      1000,
    );
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!localStream) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCameraEnabled(localStream.getVideoTracks().some((track) => track.enabled));
    setMicrophoneEnabled(localStream.getAudioTracks().some((track) => track.enabled));
  }, [localStream]);

  useEffect(() => {
    recordingSessionRef.current?.updateSources(recordingSources);
  }, [recordingSources]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recordingSessionRef.current?.dispose();
      recordingSessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (recordingStatus !== "recording") return undefined;
    const intervalId = window.setInterval(
      () => setRecordingSeconds((seconds) => seconds + 1),
      1000,
    );
    return () => window.clearInterval(intervalId);
  }, [recordingStatus]);

  async function copyMeetingLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (copyError) {
      console.error("Unable to copy the meeting link:", copyError);
    }
  }

  function toggleTrack(trackType, setEnabled, enabled) {
    const tracks =
      trackType === "audio"
        ? localStream?.getAudioTracks()
        : localStream?.getVideoTracks();
    const nextEnabled = !enabled;
    tracks?.forEach((track) => {
      track.enabled = nextEnabled;
    });
    setEnabled(nextEnabled);
  }

  async function handleStartRecording() {
    if (
      recordingSessionRef.current ||
      recordingStartPendingRef.current ||
      recordingStatus === "starting" ||
      recordingStatus === "processing" ||
      recordingStatus === "uploading" ||
      !canRecord
    ) {
      return;
    }

    recordingStartPendingRef.current = true;
    setRecordingStatus("starting");
    setRecordingSeconds(0);
    setUploadProgress(0);
    setRecordingUrl("");
    setRecordingError("");
    try {
      const session = await startMeetingRecording(recordingSources, (recordingFailure) => {
        if (!mountedRef.current) return;
        recordingSessionRef.current = null;
        setRecordingError(
          recordingFailure?.message || "The meeting recording failed unexpectedly.",
        );
        setRecordingStatus("error");
      });
      if (!mountedRef.current) {
        session.dispose();
        return;
      }
      recordingSessionRef.current = session;
      setRecordingStatus("recording");
    } catch (startError) {
      if (!mountedRef.current) return;
      setRecordingError(startError?.message || String(startError));
      setRecordingStatus("error");
    } finally {
      recordingStartPendingRef.current = false;
    }
  }

  async function handleStopRecording() {
    const session = recordingSessionRef.current;
    if (!session || recordingStatus !== "recording") return;

    recordingSessionRef.current = null;
    setRecordingStatus("processing");
    setRecordingError("");
    try {
      const blob = await session.stop();
      session.dispose();
      if (!mountedRef.current) return;
      if (!blob.size) throw new Error("The recording did not contain any media.");

      const extension = blob.type.includes("mp4") ? "mp4" : "webm";
      const file = new File(
        [blob],
        `meeting-${meetingId}-${Date.now()}.${extension}`,
        { type: blob.type || `video/${extension}` },
      );
      const formData = new FormData();
      formData.append("avatar", file);

      setRecordingStatus("uploading");
      setUploadProgress(0);
      const result = await upload(formData, (event) => {
        if (mountedRef.current && event.total) {
          setUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        }
      });
      const url = result?.secure_url || result?.url;
      if (result?.success !== true || !url) {
        throw new Error(result?.message || "Cloudinary did not return a recording URL.");
      }

      if (!mountedRef.current) return;
      setRecordingUrl(url);
      setUploadProgress(100);
      setRecordingStatus("success");
    } catch (stopError) {
      session.dispose();
      if (!mountedRef.current) return;
      setRecordingError(stopError?.message || String(stopError));
      setRecordingStatus("error");
    }
  }

  const meetingName = `Meeting ${meetingId.slice(0, 8)}`;
  const people = [
    { socketId: "local", name: user.name, local: true },
    ...participants.map((participant) => ({
      socketId: participant.socketId,
      name: participant.name || "Team member",
    })),
  ];

  return (
    <main className="meeting-room">
      <header className="meeting-room-header">
        <button
          aria-label="Back to meetings"
          className="meeting-back-button"
          onClick={() => navigate("/meetings")}
          type="button"
        >
          <FiArrowLeft size={17} />
        </button>
        <div className="meeting-room-title">
          <strong>{meetingName}</strong>
          <span><i className={`meeting-status-dot ${status === "joined" ? "is-connected" : ""}`} />{status === "joined" ? "In this meeting" : status === "error" ? "Connection issue" : "Connecting"}</span>
        </div>
        <div className="meeting-room-header-actions">
          <div className="meeting-duration">{formatDuration(elapsedSeconds)}</div>
          <button className="meeting-share-button" onClick={copyMeetingLink} type="button">
            {copied ? <FiCheck size={15} /> : <FiCopy size={15} />}
            {copied ? "Copied" : "Share invite"}
          </button>
          <button
            aria-label="Show participants"
            aria-pressed={peopleOpen}
            className={`meeting-people-button${peopleOpen ? " is-active" : ""}`}
            onClick={() => setPeopleOpen((open) => !open)}
            type="button"
          >
            <FiUsers size={17} />
            <span>{people.length}</span>
          </button>
        </div>
      </header>

      {(error || mediaError) && (
        <div className={`meeting-room-alert${error ? " meeting-room-alert-error" : ""}`} role="status">
          <span>{error || mediaError}</span>
          {status === "error" && (
            <button onClick={() => navigate("/meetings")} type="button">Back to meetings</button>
          )}
        </div>
      )}
      {screenShareNotification && (
        <div className="meeting-room-alert" role="status" aria-live="polite">
          <span>{screenShareNotification.message}</span>
        </div>
      )}
      {recordingStatus !== "idle" && (
        <section
          aria-live="polite"
          className={`meeting-recording-banner meeting-recording-${recordingStatus}`}
          role={recordingStatus === "error" ? "alert" : "status"}
        >
          <div className="meeting-recording-message">
            {recordingStatus === "recording" && (
              <span className="meeting-recording-indicator" aria-hidden="true" />
            )}
            <strong>
              {recordingStatus === "starting" && "Starting recording…"}
              {recordingStatus === "recording" && "Recording"}
              {recordingStatus === "processing" && "Preparing recording…"}
              {recordingStatus === "uploading" && "Uploading recording"}
              {recordingStatus === "success" && "Recording uploaded successfully"}
              {recordingStatus === "error" && "Recording failed"}
            </strong>
            {recordingStatus === "recording" && (
              <time>{formatDuration(recordingSeconds)}</time>
            )}
            {recordingStatus === "uploading" && <span>{uploadProgress}%</span>}
            {recordingStatus === "error" && <span>{recordingError}</span>}
          </div>
          {recordingStatus === "uploading" && (
            <progress
              aria-label="Recording upload progress"
              max="100"
              value={uploadProgress}
            />
          )}
          {recordingUrl && recordingStatus === "success" && (
            <a
              className="meeting-recording-link"
              href={recordingUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open recording
            </a>
          )}
        </section>
      )}

      <div className={`meeting-room-content${peopleOpen ? " people-panel-open" : ""}`}>
        <section className="meeting-stage" aria-label="Meeting video">
          <div className={`meeting-video-grid${participants.length > 0 ? " has-participants" : ""}`}>
            <VideoTile
              cameraEnabled={screenStream ? true : cameraEnabled}
              isLocal
              name={user.name}
              stream={screenStream || localStream}
            />
            {participants.map((participant) => (
              <VideoTile
                key={participant.socketId}
                name={participant.name || "Team member"}
                stream={participant.stream}
              />
            ))}
          </div>
          {!participants.length && status === "joined" && (
            <div className="meeting-invite-hint">
              <span>Just you for now</span>
              <button onClick={copyMeetingLink} type="button">
                {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
                Invite someone
              </button>
            </div>
          )}
        </section>

        {peopleOpen && (
          <aside className="meeting-people-panel" aria-label="Participants">
            <div className="meeting-people-heading">
              <div><h2>People</h2><span>{people.length} in this meeting</span></div>
              <button aria-label="Close participants" onClick={() => setPeopleOpen(false)} type="button">×</button>
            </div>
            <ul>
              {people.map((person) => (
                <li key={person.socketId}>
                  <span className="meeting-person-avatar small">{initials(person.name) || "?"}</span>
                  <span className="meeting-person-name">{person.name}{person.local ? " (you)" : ""}</span>
                  {person.local && <FiMoreHorizontal aria-hidden="true" size={17} />}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <footer className="meeting-controls">
        <div className="meeting-controls-meta">
          <span>{new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date())}</span>
          <span className="meeting-controls-divider" />
          <span>{meetingName}</span>
        </div>
        <div className="meeting-control-buttons">
          <button
            aria-label={microphoneEnabled ? "Mute microphone" : "Unmute microphone"}
            aria-pressed={!microphoneEnabled}
            className={`meeting-control${!microphoneEnabled ? " is-off" : ""}`}
            disabled={!localStream?.getAudioTracks().length}
            onClick={() => toggleTrack("audio", setMicrophoneEnabled, microphoneEnabled)}
            type="button"
          >
            {microphoneEnabled ? <FiMic size={19} /> : <FiMicOff size={19} />}
            <span>{microphoneEnabled ? "Mute" : "Unmute"}</span>
          </button>
          <button
            aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
            aria-pressed={!cameraEnabled}
            className={`meeting-control${!cameraEnabled ? " is-off" : ""}`}
            disabled={!localStream?.getVideoTracks().length}
            onClick={() => toggleTrack("video", setCameraEnabled, cameraEnabled)}
            type="button"
          >
            {cameraEnabled ? <FiVideo size={19} /> : <FiVideoOff size={19} />}
            <span>{cameraEnabled ? "Stop video" : "Start video"}</span>
          </button>
          <button
            aria-label={screenStream ? "Stop screen sharing" : "Share screen"}
            className="meeting-control meeting-screen-control"
            onClick={screenStream ? stopScreenShare : startScreenShare}
            type="button"
          >
            <FiMonitor size={19} />
            <span>{screenStream ? "Stop sharing" : "Share screen"}</span>
          </button>
          <button
            aria-label={recordingStatus === "recording" ? "Stop recording" : "Start recording"}
            aria-pressed={recordingStatus === "recording"}
            className={`meeting-control meeting-record-control${recordingStatus === "recording" ? " is-recording" : ""}`}
            disabled={
              recordingStatus === "recording"
                ? false
                : !canRecord ||
                  status !== "joined" ||
                  ["starting", "processing", "uploading"].includes(recordingStatus)
            }
            onClick={
              recordingStatus === "recording"
                ? handleStopRecording
                : handleStartRecording
            }
            type="button"
          >
            {recordingStatus === "recording" ? <FiSquare size={18} /> : <FiCircle size={19} />}
            <span>
              {recordingStatus === "recording"
                ? "Stop recording"
                : recordingStatus === "starting"
                  ? "Starting…"
                  : "Start recording"}
            </span>
          </button>
          <button
            aria-label="Leave meeting"
            className="meeting-leave-button"
            onClick={() => navigate("/meetings")}
            type="button"
          >
            <FiPhoneOff size={19} />
            <span>Leave</span>
          </button>
        </div>
        <div className="meeting-controls-spacer" />
      </footer>
    </main>
  );
}
