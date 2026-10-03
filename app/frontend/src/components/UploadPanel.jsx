import { useState, useRef, useEffect } from "react";
import Loader from "./Loader.jsx";

function UploadPanel({ onNewCapture }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  function handleFileChange(e) {
  const selected = e.target.files[0];
  if (!selected) return;
  setFile(selected);

  // FileReader converts the actual image bytes into a base64 text string —
  // unlike a blob URL, this text is genuinely portable: it can be sent over
  // the network and stored, and it'll still work after a refresh.
  const reader = new FileReader();
  reader.onload = () => setPreviewUrl(reader.result);
  reader.readAsDataURL(selected);
  }

  function handleAnalyze() {
    if (!file) return;
    setProgress(0);
    setProcessing(true);
  }

  // This runs automatically whenever "processing" changes value.
  useEffect(() => {
    if (!processing) return;

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 2;
      });
    }, 40);

    // Cleanup function: React calls this if the component disappears
    // or "processing" changes again before the interval finishes,
    // so we never leave a ticking timer running in the background by accident.
    return () => clearInterval(interval);
  }, [processing]);

  // Separate effect: once progress actually reaches 100, finish up.
  useEffect(() => {
    if (progress < 100 || !processing) return;

    const newCapture = {
      id: `upload-${Date.now()}`,
      camera: "Manual upload",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      conditions: [],  
      make: "Toyota",
      model: "Corolla",
      color: "White",
      bodyType: "Hatchback",
      makeConf: 0.88,
      modelConf: 0.71,
      colorConf: 0.95,
      bodyTypeConf: 0.83,
      imageUrl: previewUrl,
      boxes: [{ label: "Vehicle", color: "#146CFD", x: 15, y: 20, w: 65, h: 50 }],
      damage: [],
    };

    onNewCapture(newCapture);
    setProcessing(false);
    setFile(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [progress, processing]);

  return (
    <>
      <div className="card" style={{ padding: "16px", marginBottom: "16px" }}>
        <label className="upload-dropzone">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
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
          disabled={!file || processing}
          style={{ width: "100%", marginTop: "10px" }}
        >
          {processing ? "Analysing..." : "Run detection"}
        </button>
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
          <Loader percent={progress} />
          <div style={{ color: "white", marginTop: "16px", fontSize: "14px" }}>
            Running vehicle detection model...
          </div>
        </div>
      )}
    </>
  );
}

export default UploadPanel;