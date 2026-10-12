import { useState, useRef, useEffect } from "react";
import Loader from "./Loader.jsx";

// The server accepts a request body of up to 10 MB, and a picture grows by about a third when
// it is sent as text, so anything over about 7 MB would be refused.
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;

function UploadPanel({ onDetect, detectAvailable }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState([]);
  const inputRef = useRef(null);

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (!selected) return;
    setError(null);
    setNotes([]);

    if (selected.type !== "image/jpeg" && selected.type !== "image/png") {
      setError("Please choose a JPG or PNG image.");
      e.target.value = "";
      return;
    }
    if (selected.size > MAX_IMAGE_BYTES) {
      setError("That image is larger than 7 MB. Please choose a smaller one.");
      e.target.value = "";
      return;
    }
    setFile(selected);

    // FileReader turns the image bytes into base64 text, which can be sent to the server.
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(selected);
  }

  async function handleAnalyze() {
    if (!file || !previewUrl || processing) return;
    setError(null);
    setNotes([]);
    setProgress(0);
    setProcessing(true);
    try {
      const warnings = await onDetect(previewUrl);
      setProgress(100);
      setNotes(warnings);
      setFile(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      // Keep the image so the person can simply try again.
      setError(err.fromServer ? err.message : "Could not reach the server. Check that it is running, then try again.");
    } finally {
      setProcessing(false);
    }
  }

  // The model gives no progress updates, so the bar creeps towards 90% while we wait.
  useEffect(() => {
    if (!processing) return;
    const interval = setInterval(() => {
      setProgress((p) => p + (90 - p) * 0.04);
    }, 100);
    return () => clearInterval(interval);
  }, [processing]);

  const noModel = detectAvailable === false;
  const isDemo = notes.some((n) => n.startsWith("DEMO MODE"));

  return (
    <>
      <div className="card" style={{ padding: "16px", marginBottom: "16px" }}>
        <label className="upload-dropzone">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          {previewUrl ? (
            <img src={previewUrl} alt="Preview" style={{ width: "100%", borderRadius: "6px", display: "block" }} />
          ) : (
            <div style={{ color: "#495054" }}>
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>⬆</div>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>Click to upload an image</div>
              <div style={{ fontSize: "11px", marginTop: "2px" }}>JPG or PNG</div>
            </div>
          )}
        </label>

        {file && <div style={{ fontSize: "12px", color: "#495054", marginTop: "8px" }}>{file.name}</div>}

        <button
          className="btn-primary"
          onClick={handleAnalyze}
          disabled={!file || !previewUrl || processing || noModel}
          style={{ width: "100%", marginTop: "10px" }}
        >
          {processing ? "Analysing..." : "Run Detection"}
        </button>

        {noModel && (
          <div style={{ fontSize: "12px", color: "#495054", marginTop: "8px" }}>
            No detection model is connected to this server yet, so images cannot be analysed here.
          </div>
        )}

        {error && (
          <div role="alert" style={{ fontSize: "12px", color: "#E1261C", marginTop: "8px" }}>
            {error}
          </div>
        )}

        {notes.length > 0 && (
          <div
            style={{
              fontSize: "12px",
              marginTop: "8px",
              padding: "8px 10px",
              borderRadius: "6px",
              background: isDemo ? "#FFF4D6" : "#EEF2F6",
              color: "#22272B",
            }}
          >
            {notes.map((n, i) => (
              <div key={i} style={{ fontWeight: n.startsWith("DEMO MODE") ? 700 : 400 }}>{n}</div>
            ))}
          </div>
        )}
      </div>

      {processing && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <Loader percent={Math.round(progress)} />
          <div style={{ color: "white", marginTop: "16px", fontSize: "14px" }}>
            Running vehicle detection model...
          </div>
        </div>
      )}
    </>
  );
}

export default UploadPanel;