export default function LoadingScreen() {
  return (
    <div
      role="status"
      className="fixed inset-0 z-50 bg-background">
      <span className="sr-only">Loading…</span>
    </div>
  );
}
