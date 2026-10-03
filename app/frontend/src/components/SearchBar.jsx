import { colors } from "../theme.js";

function SearchBar({ query, onChange }) {
  return (
    <div style={{ padding: "16px 20px 0" }}>
      <input
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by camera, make, or model..."
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: "10px",
          border: `1px solid ${colors.grey03}`,
          background: colors.white,
          fontSize: "13px",
          outline: "none",
        }}
      />
    </div>
  );
}

export default SearchBar;