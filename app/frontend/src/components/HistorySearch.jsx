import { colors } from "../theme.js";
import SearchBar from "./SearchBar.jsx";

function HistorySearch({ captures, searchQuery, onSearchChange, downloadJson }) {
  const filtered = captures.filter((c) => {
    const q = searchQuery.toLowerCase();
    return c.camera.toLowerCase().includes(q) || c.make.toLowerCase().includes(q) || c.model.toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: "20px", maxWidth: "900px" }}>
      <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>Search & export</h2>
      <p style={{ fontSize: "13px", color: colors.grey02, marginBottom: "16px" }}>
        Look up past captures and export records for reporting.
      </p>

      <SearchBar query={searchQuery} onChange={onSearchChange} />

      <button
        style={{
          marginTop: "14px", padding: "10px 16px", background: "white", color: colors.navy,
          border: `1px solid ${colors.navy}`, borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
        }}
        onClick={() => downloadJson(captures, "all-captures.json")}
      >
        Export all captures
      </button>

      <div className="card" style={{ padding: "0", marginTop: "16px" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "16px", fontSize: "13px", color: colors.grey02 }}>No matches.</div>
        ) : (
          filtered.map((cap) => (
            <div key={cap.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${colors.grey04}` }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600 }}>{cap.camera} — {cap.time}</div>
                <div style={{ fontSize: "12px", color: colors.grey02 }}>{cap.make} {cap.model}, {cap.color}</div>
              </div>
              <button
                onClick={() => downloadJson(cap, `${cap.id}.json`)}
                style={{ background: "white", border: `1px solid ${colors.grey03}`, borderRadius: "4px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}
              >
                Export
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default HistorySearch;