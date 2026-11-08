export default function UsageSkeleton() {
  return (
    <>
      <div className="flex justify-between items-center">
        <span className="skeleton h-1.5 overflow-hidden rounded-full bg-background-focus w-30" />
        <span className="skeleton h-1.5 overflow-hidden rounded-full bg-background-focus w-30" />
      </div>
      <span className="skeleton h-2 overflow-hidden rounded-full bg-background-focus" />

      <div className="flex justify-between items-center mt-1">
        <span className="skeleton h-1.5 overflow-hidden rounded-full bg-background-focus w-30" />
        <span className="skeleton h-1.5 overflow-hidden rounded-full bg-background-focus w-30" />
      </div>
      <span className="skeleton h-2 overflow-hidden rounded-full bg-background-focus" />
    </>
  )
}
