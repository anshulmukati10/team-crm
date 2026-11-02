import { useRef, useState } from "react";
import { FiCheck, FiPaperclip, FiUpload, FiX } from "react-icons/fi";
import { upload } from "../../features/chat/chatApi";

export default function FileUploadButton() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null);

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setStatus(null);
  }

  async function handleUpload() {
    if (!file || uploading) return;

    const formData = new FormData();
    formData.append("avatar", file);
    setUploading(true);
    setStatus({ type: "loading", message: `Uploading ${file.name}…` });

    try {
      const result = await upload(formData);
      if (!result || typeof result !== "object" || result.success !== true) {
        const message =
          result?.message ||
          result?.error?.message ||
          "The server did not confirm the upload. Check the API response.";
        throw new Error(message);
      }

      setStatus({ type: "success", message: "File uploaded successfully." });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setStatus({
        type: "error",
        message: `Upload failed: ${error?.message || String(error)}`,
      });
    } finally {
      setUploading(false);
    }
  }

  function clearFile() {
    setFile(null);
    setStatus(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="chat-file-upload">
      <input
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        className="visually-hidden"
        disabled={uploading}
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
      <button
        aria-label={file ? `Selected file: ${file.name}` : "Choose a file"}
        className="chat-file-button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        title={file?.name || "Attach a file"}
        type="button"
      >
        <FiPaperclip aria-hidden="true" size={17} />
      </button>
      {file && (
        <div className="chat-file-selection">
          <span className="chat-file-name" title={file.name}>{file.name}</span>
          <button
            aria-label="Remove selected file"
            className="chat-file-clear"
            disabled={uploading}
            onClick={clearFile}
            type="button"
          >
            <FiX size={13} />
          </button>
          <button
            className="chat-file-submit"
            disabled={uploading}
            onClick={handleUpload}
            type="button"
          >
            <FiUpload size={13} />
            {uploading ? "Uploading" : "Upload"}
          </button>
        </div>
      )}
      {status && (
        <span
          className={`chat-file-status chat-file-status-${status.type}`}
          role={status.type === "error" ? "alert" : "status"}
        >
          {status.type === "success" && <FiCheck aria-hidden="true" size={13} />}
          {status.message}
        </span>
      )}
    </div>
  );
}
