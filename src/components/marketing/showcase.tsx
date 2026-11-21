"use client";

import { lazy, Suspense } from "react";

// Split the player into its own chunk; the skeleton holds its space meanwhile.
const ShowcaseVideo = lazy(() => import("./showcase-video"));

function ShowcaseSkeleton() {
  return (
    <div
      className="skeleton aspect-video w-full rounded-sm bg-background-card"
      aria-hidden="true" />
  );
}

export default function Showcase() {
  return (
    <Suspense fallback={<ShowcaseSkeleton />}>
      <ShowcaseVideo />
    </Suspense>
  );
}
