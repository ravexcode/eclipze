export default function ProfileSkeleton() {
  return (
    <section
      role="status"
      className="relative mt-auto w-full">
      <span className="sr-only">Loading profile…</span>

      <div
        aria-hidden="true"
        className="flex min-h-12 w-full items-center justify-start gap-2 p-2">
        <span className="skeleton aspect-square w-6 shrink-0 rounded-full bg-background-focus" />

        <div className="flex flex-col gap-2">
          <span className="skeleton h-2 w-24 rounded-full bg-background-focus" />
          <span className="skeleton h-1.5 w-16 rounded-full bg-background-focus" />
        </div>
      </div>
    </section>
  );
}
