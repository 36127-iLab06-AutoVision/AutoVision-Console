import { colors } from "../theme.js";
import SearchBar from "./SearchBar.jsx";
import { describeVehicles, isFlagged } from "../utils/confidence.js";

function HistorySearch({ captures, searchQuery, onSearchChange, downloadJson, threshold = 0.75 }) {
  const q = searchQuery.toLowerCase();
  const filtered = captures.filter(
    (c) =>
      c.camera.toLowerCase().includes(q) ||
      String(c.id).toLowerCase().includes(q) ||
      describeVehicles(c).toLowerCase().includes(q)
  );

  return (
    <div style={{ padding: "20px", maxWidth: "900px" }}>
      <h2 style={{ fontSize: "20px", marginBottom: "6px" }}>History</h2>
      <p style={{ fontSize: "14px", color: colors.grey02, marginTop: 0, marginBottom: "16px" }}>
        Search past captures and export records for reporting. Exports are saved as JSON files.
      </p>

      <SearchBar query={searchQuery} onChange={onSearchChange} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "14px", flexWrap: "wrap" }}>
        <button
          style={{
            padding: "10px 16px", background: "white", color: colors.navy,
            border: `1px solid ${colors.navy}`, borderRadius: "6px", fontSize: "14px", fontWeight: 600, cursor: "pointer",
          }}
          onClick={() => downloadJson(captures, "all-captures.json")}
        >
          Export All Captures
        </button>
        <span style={{ fontSize: "13px", color: colors.grey02 }}>
          Showing {filtered.length} of {captures.length} captures
        </span>
      </div>

      <div className="card" style={{ padding: "0", marginTop: "16px" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "16px", fontSize: "14px", color: colors.grey02 }}>No matches.</div>
        ) : (
          filtered.map((cap) => (
            <div
              key={cap.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: `1px solid ${colors.grey04}` }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>{cap.camera} - {cap.time}</span>
                  {isFlagged(cap, threshold) && (
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "white", background: colors.red, padding: "2px 8px", borderRadius: "4px" }}>
                      REVIEW
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "13px", color: colors.grey02, marginTop: "2px", overflowWrap: "anywhere" }}>
                  {describeVehicles(cap)}
                </div>
              </div>
              <button
                onClick={() => downloadJson(cap, `${cap.id}.json`)}
                style={{ flexShrink: 0, background: "white", border: `1px solid ${colors.grey03}`, borderRadius: "4px", padding: "7px 14px", fontSize: "13px", cursor: "pointer" }}
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