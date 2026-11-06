import Image from "next/image";

export default function LoadingScreen() {
  return (
    <div
      role="status"
      className="fixed inset-0 z-50 bg-background">
      <Image
        src="/logo_loading.svg"
        width={150}
        height={150}
        alt="Loading logo"
        className="aspect-square block w-30 animate-pulse" />
    </div>
  );
}
