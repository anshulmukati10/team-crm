const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

function getTrackSignature(stream) {
  return stream
    .getTracks()
    .map((track) => `${track.id}:${track.kind}:${track.readyState}`)
    .join("|");
}

function chooseMimeType() {
  if (typeof MediaRecorder !== "function" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }

  return [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function drawVideoCover(context, video, x, y, width, height) {
  const sourceRatio = video.videoWidth / video.videoHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = video.videoWidth;
  let sourceHeight = video.videoHeight;

  if (sourceRatio > targetRatio) {
    sourceWidth = video.videoHeight * targetRatio;
    sourceX = (video.videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = video.videoWidth / targetRatio;
    sourceY = (video.videoHeight - sourceHeight) / 2;
  }

  context.drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function createParticipantEntry(source, audioContext, audioDestination) {
  const { id, name, stream } = source;
  const liveVideo = stream.getVideoTracks().some((track) => track.readyState === "live");
  const liveAudio = stream.getAudioTracks().some((track) => track.readyState === "live");
  const video = liveVideo ? document.createElement("video") : null;

  if (video) {
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.play().catch((playError) => {
      console.warn("Unable to play a participant stream for recording:", playError);
    });
  }

  let audioSource = null;
  if (liveAudio && audioContext && audioDestination) {
    const audioStream = new MediaStream(
      stream.getAudioTracks().filter((track) => track.readyState === "live"),
    );
    audioSource = audioContext.createMediaStreamSource(audioStream);
    audioSource.connect(audioDestination);
  }

  return {
    id,
    stream,
    signature: getTrackSignature(stream),
    name: name || "Participant",
    video,
    audioSource,
  };
}

export async function startMeetingRecording(initialSources, onError) {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Recording is not supported by this browser.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const canvasContext = canvas.getContext("2d");
  if (!canvasContext || typeof canvas.captureStream !== "function") {
    throw new Error("This browser cannot create a combined meeting video.");
  }

  const audioContextConstructor =
    window.AudioContext || window.webkitAudioContext;
  if (!audioContextConstructor) {
    throw new Error("This browser cannot combine participant audio for recording.");
  }

  let audioContext = null;
  let audioDestination = null;
  try {
    audioContext = new audioContextConstructor();
    audioDestination = audioContext.createMediaStreamDestination();
    await audioContext.resume();
  } catch (error) {
    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch((closeError) => {
        console.error("Unable to close the meeting recording audio context:", closeError);
      });
    }
    throw new Error("Unable to initialize the meeting audio mixer.", {
      cause: error,
    });
  }

  const canvasStream = canvas.captureStream(30);
  const recordingStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(audioDestination?.stream.getAudioTracks() || []),
  ]);
  const entries = new Map();
  let animationFrameId = null;
  let cleanedUp = false;

  function removeEntry(id) {
    const entry = entries.get(id);
    if (!entry) return;
    entry.audioSource?.disconnect();
    entry.video?.pause();
    if (entry.video) entry.video.srcObject = null;
    entries.delete(id);
  }

  function updateSources(sources) {
    const activeIds = new Set();

    sources.forEach((source) => {
      const { id, name, stream } = source;
      if (!stream || !stream.getTracks().some((track) => track.readyState === "live")) {
        return;
      }

      activeIds.add(id);
      const signature = getTrackSignature(stream);
      const previous = entries.get(id);
      if (previous?.stream === stream && previous.signature === signature) {
        previous.name = name;
        return;
      }

      removeEntry(id);
      entries.set(id, createParticipantEntry(source, audioContext, audioDestination));
    });

    entries.forEach((_, id) => {
      if (!activeIds.has(id)) removeEntry(id);
    });
  }

  function drawFrame() {
    canvasContext.fillStyle = "#11141c";
    canvasContext.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const participants = Array.from(entries.values());
    if (!participants.length) {
      animationFrameId = window.requestAnimationFrame(drawFrame);
      return;
    }

    const columns = participants.length === 1 ? 1 : participants.length <= 4 ? 2 : 3;
    const rows = Math.ceil(participants.length / columns);
    const tileWidth = CANVAS_WIDTH / columns;
    const tileHeight = CANVAS_HEIGHT / rows;

    participants.forEach(({ name, video }, index) => {
      const x = (index % columns) * tileWidth;
      const y = Math.floor(index / columns) * tileHeight;
      canvasContext.fillStyle = "#222634";
      canvasContext.fillRect(x, y, tileWidth, tileHeight);

      if (
        video &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth &&
        video.videoHeight
      ) {
        drawVideoCover(canvasContext, video, x, y, tileWidth, tileHeight);
      }

      canvasContext.fillStyle = "#10131cbf";
      canvasContext.fillRect(x + 16, y + tileHeight - 54, tileWidth - 32, 38);
      canvasContext.fillStyle = "#ffffff";
      canvasContext.font = "600 20px sans-serif";
      canvasContext.textBaseline = "middle";
      canvasContext.fillText(name.slice(0, 48), x + 28, y + tileHeight - 35, tileWidth - 56);
      canvasContext.strokeStyle = "#ffffff30";
      canvasContext.lineWidth = 2;
      canvasContext.strokeRect(x + 1, y + 1, tileWidth - 2, tileHeight - 2);
    });

    animationFrameId = window.requestAnimationFrame(drawFrame);
  }

  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;

    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    Array.from(entries.keys()).forEach(removeEntry);
    recordingStream.getTracks().forEach((track) => track.stop());
    canvasStream.getTracks().forEach((track) => track.stop());

    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch((error) => {
        console.error("Unable to close the meeting recording audio context:", error);
      });
    }
  }

  const mimeType = chooseMimeType();
  const recorderOptions = {
    videoBitsPerSecond: 2_500_000,
    audioBitsPerSecond: 128_000,
  };
  if (mimeType) recorderOptions.mimeType = mimeType;

  updateSources(initialSources);
  drawFrame();

  let recorder;
  try {
    recorder = new MediaRecorder(recordingStream, recorderOptions);
  } catch (error) {
    cleanup();
    throw new Error(error.message || "Unable to initialize the meeting recorder.", {
      cause: error,
    });
  }

  const chunks = [];
  let resolveStopped;
  let rejectStopped;
  let finalized = false;

  const stopped = new Promise((resolve, reject) => {
    resolveStopped = resolve;
    rejectStopped = reject;
  });
  stopped.catch(() => {});

  const finishRecording = (value, error) => {
    if (finalized) return;
    finalized = true;
    cleanup();

    if (error) {
      chunks.length = 0;
      onError?.(error);
      rejectStopped(error);
      return;
    }

    resolveStopped(value);
  };

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data?.size) chunks.push(event.data);
  });
  recorder.addEventListener("error", (event) => {
    finishRecording(null, event.error || new Error("The meeting recording failed."));
  });
  recorder.addEventListener("stop", () => {
    const blob = new Blob(chunks, {
      type: recorder.mimeType || mimeType || "video/webm",
    });
    chunks.length = 0;
    finishRecording(blob);
  });

  try {
    recorder.start(1000);
  } catch (error) {
    cleanup();
    throw new Error(error.message || "Unable to start the meeting recording.", {
      cause: error,
    });
  }

  const stopRecording = () => {
    if (recorder.state === "recording" || recorder.state === "paused") {
      recorder.stop();
      return stopped;
    }

    if (!finalized) {
      finishRecording(new Blob([], { type: recorder.mimeType || "video/webm" }));
    }
    return stopped;
  };

  return {
    updateSources,
    stop: stopRecording,
    dispose: stopRecording,
  };
}
