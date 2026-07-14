export default function WaveBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-[#0c0118] via-[#1a0533] to-[#0c0118]"
    >
      <div className="wave-blob wave-blob-a" />
      <div className="wave-blob wave-blob-b" />
      <div className="wave-blob wave-blob-c" />
    </div>
  );
}
