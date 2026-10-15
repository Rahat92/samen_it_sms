export default function Pill({ status, children }) {
  return <span className={`pill ${status}`}>{children ?? status}</span>;
}
