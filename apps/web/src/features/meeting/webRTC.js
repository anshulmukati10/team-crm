import { useCallback, useEffect, useRef, useState } from "react";
import { meetingSocket } from "./meetingSocket";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function useWebRTC(meetingId) {
  const [localStream, setLocalStream] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState("");

  const peers = useRef(new Map());
  const pendingCandidates = useRef(new Map());
  const streamRef = useRef(null);
  const joinedRef = useRef(false);
  const leaveTimeoutRef = useRef(null);

  const updateParticipant = useCallback((socketId, stream, name) => {
    setParticipants((current) => {
      const existing = current.find((participant) => participant.socketId === socketId);

      if (existing) {
        return current.map((participant) =>
          participant.socketId === socketId
            ? {
                ...participant,
                stream: stream || participant.stream,
                name: name || participant.name,
              }
            : participant,
        );
      }

      return [...current, { socketId, stream, name }];
    });
  }, []);

  const removeParticipant = useCallback((socketId) => {
    const peer = peers.current.get(socketId);
    if (peer) {
      peer.close();
      peers.current.delete(socketId);
    }
    pendingCandidates.current.delete(socketId);

    setParticipants((current) =>
      current.filter((participant) => participant.socketId !== socketId),
    );
  }, []);

  const createPeer = useCallback(
    (target, shouldCreateOffer) => {
      if (peers.current.has(target)) {
        return peers.current.get(target);
      }

      const peer = new RTCPeerConnection(ICE_SERVERS);
      peers.current.set(target, peer);

      streamRef.current?.getTracks().forEach((track) => {
        peer.addTrack(track, streamRef.current);
      });

      peer.ontrack = (event) => {
        updateParticipant(target, event.streams[0]);
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          meetingSocket.emit("webrtc:ice-candidate", {
            target,
            candidate: event.candidate,
          });
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed" || peer.connectionState === "closed") {
          removeParticipant(target);
        }
      };

      if (shouldCreateOffer) {
        peer
          .createOffer()
          .then((offer) => peer.setLocalDescription(offer))
          .then(() => {
            meetingSocket.emit("webrtc:offer", {
              target,
              offer: peer.localDescription,
            });
          })
          .catch((offerError) => {
            console.error("Unable to start the video connection:", offerError);
            setError("Unable to connect your video to a participant.");
          });
      }

      return peer;
    },
    [removeParticipant, updateParticipant],
  );

  useEffect(() => {
    let mounted = true;
    const pendingCandidatesForEffect = pendingCandidates.current;
    if (leaveTimeoutRef.current !== null) {
      window.clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    joinedRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("connecting");
    setError("");
    setMediaError("");

    const joinMeeting = () => {
      if (joinedRef.current || !mounted) return;

      setStatus("joining");
      meetingSocket.timeout(10000).emit("meeting:join", meetingId, (timeoutError, response) => {
        if (!mounted) return;

        if (timeoutError || !response?.ok) {
          setStatus("error");
          setError(response?.message || "Unable to join this meeting. Check the link and try again.");
          return;
        }

        joinedRef.current = true;
        setStatus("joined");
        (response.existingParticipants || []).forEach((participant) => {
          updateParticipant(
            participant.socketId,
            null,
            participant.name,
          );
          createPeer(participant.socketId, true);
        });
      });
    };

    async function addPendingCandidates(peer, sender) {
      const candidates = pendingCandidatesForEffect.get(sender) || [];
      pendingCandidatesForEffect.delete(sender);
      for (const candidate of candidates) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }

    const handleOffer = async ({ sender, offer }) => {
      try {
        const peer = createPeer(sender, false);
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        await addPendingCandidates(peer, sender);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        meetingSocket.emit("webrtc:answer", {
          target: sender,
          answer: peer.localDescription,
        });
      } catch (offerError) {
        console.error("Unable to answer a video connection:", offerError);
        if (mounted) setError("Unable to connect your video to a participant.");
      }
    };

    const handleAnswer = async ({ sender, answer }) => {
      try {
        const peer = peers.current.get(sender);
        if (peer) {
          await peer.setRemoteDescription(new RTCSessionDescription(answer));
          await addPendingCandidates(peer, sender);
        }
      } catch (answerError) {
        console.error("Unable to accept a video connection:", answerError);
        if (mounted) setError("Unable to connect your video to a participant.");
      }
    };

    const handleCandidate = async ({ sender, candidate }) => {
      try {
        const peer = peers.current.get(sender);
        if (!candidate) return;
        if (!peer || !peer.remoteDescription) {
          const candidates = pendingCandidatesForEffect.get(sender) || [];
          candidates.push(candidate);
          pendingCandidatesForEffect.set(sender, candidates);
          return;
        }
        if (peer) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (candidateError) {
        console.error("Unable to add a video connection candidate:", candidateError);
        if (mounted) setError("A video connection could not be completed.");
      }
    };

    const handleParticipantJoined = ({ socketId, name }) => {
      updateParticipant(socketId, null, name);
    };

    const handleParticipantLeft = ({ socketId }) => {
      removeParticipant(socketId);
    };

    const handleConnectError = (connectionError) => {
      if (mounted) {
        setStatus("error");
        setError(connectionError.message || "Unable to connect to the meeting service.");
      }
    };

    const handleDisconnect = () => {
      if (!mounted) return;
      joinedRef.current = false;
      setStatus("connecting");
      peers.current.forEach((peer) => peer.close());
      peers.current.clear();
      pendingCandidatesForEffect.clear();
      setParticipants([]);
    };

    meetingSocket.on("webrtc:offer", handleOffer);
    meetingSocket.on("webrtc:answer", handleAnswer);
    meetingSocket.on("webrtc:ice-candidate", handleCandidate);
    meetingSocket.on("meeting:participant-joined", handleParticipantJoined);
    meetingSocket.on("meeting:participant-left", handleParticipantLeft);
    meetingSocket.on("connect_error", handleConnectError);
    meetingSocket.on("disconnect", handleDisconnect);
    meetingSocket.on("connect", joinMeeting);

    async function startMeeting() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera and microphone access is not available in this browser.");
        }
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (mediaAccessError) {
          if (!["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"].includes(mediaAccessError.name)) {
            throw mediaAccessError;
          }

          const availableTracks = [];
          const mediaErrors = [];
          for (const constraint of [{ audio: true }, { video: true }]) {
            try {
              const deviceStream = await navigator.mediaDevices.getUserMedia(constraint);
              availableTracks.push(...deviceStream.getTracks());
            } catch (deviceError) {
              mediaErrors.push(deviceError);
            }
          }

          if (availableTracks.length > 0) {
            stream = new MediaStream(availableTracks);
          } else {
            const denied = mediaErrors.some((deviceError) => deviceError.name === "NotAllowedError");
            setMediaError(
              denied
                ? "Camera and microphone access was denied. You can still join without them."
                : "No camera or microphone was found. You can still join without them.",
            );
          }
        }

        if (stream && !mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (stream) {
          const hasCamera = stream.getVideoTracks().length > 0;
          const hasMicrophone = stream.getAudioTracks().length > 0;
          streamRef.current = stream;
          setLocalStream(stream);
          if (!hasCamera || !hasMicrophone) {
            setMediaError(
              !hasCamera && !hasMicrophone
                ? "No camera or microphone was found. You can still join without them."
                : !hasCamera
                  ? "No camera was found. You joined with your microphone only."
                  : "No microphone was found. You joined with your camera only.",
            );
          }
        }
      } catch (mediaAccessError) {
        if (mounted) {
          setMediaError(
            mediaAccessError.name === "NotAllowedError"
              ? "Camera and microphone access was denied. You can still join without them."
              : mediaAccessError.name === "NotReadableError"
                ? "Your camera or microphone is unavailable or already in use. You can still join without them."
                : mediaAccessError.message ||
                  "Camera or microphone access failed. You can still join without them.",
          );
        }
      }

      if (!mounted) return;

      if (meetingSocket.connected) {
        joinMeeting();
      } else {
        meetingSocket.connect();
      }
    }

    startMeeting();

    return () => {
      mounted = false;
      meetingSocket.off("connect", joinMeeting);
      meetingSocket.off("webrtc:offer", handleOffer);
      meetingSocket.off("webrtc:answer", handleAnswer);
      meetingSocket.off("webrtc:ice-candidate", handleCandidate);
      meetingSocket.off("meeting:participant-joined", handleParticipantJoined);
      meetingSocket.off("meeting:participant-left", handleParticipantLeft);
      meetingSocket.off("connect_error", handleConnectError);
      meetingSocket.off("disconnect", handleDisconnect);
      meetingSocket.off("connect", joinMeeting);
      leaveTimeoutRef.current = window.setTimeout(() => {
        meetingSocket.emit("meeting:leave");
        leaveTimeoutRef.current = null;
      }, 0);

      peers.current.forEach((peer) => peer.close());
      // eslint-disable-next-line react-hooks/exhaustive-deps
      peers.current.clear();
      pendingCandidatesForEffect.clear();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      joinedRef.current = false;
    };
  }, [createPeer, meetingId, removeParticipant, updateParticipant]);

  return { localStream, participants, status, error, mediaError };
}
