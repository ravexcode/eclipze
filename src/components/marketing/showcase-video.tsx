"use client";

import { useEffect, useRef, useState } from "react";

// Start fetching a little before the video scrolls into view.
const LOAD_ROOT_MARGIN = "300px 0px";

export default function ShowcaseVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Mount the <source> only once the player is near the viewport, so the
  // file is never downloaded for visitors who don't scroll this far.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: LOAD_ROOT_MARGIN });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Play only while visible, so an offscreen loop doesn't keep decoding.
  useEffect(() => {
    const video = videoRef.current;
    if (!shouldLoad || !video) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        video.play().catch(() => {
          // Autoplay can be refused (e.g. data saver); the poster stays visible.
        });
      } else {
        video.pause();
      }
    }, { threshold: 0.25 });

    observer.observe(video);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-sm bg-background-card">
      {
        !isReady &&
        <div
          className="skeleton absolute inset-0"
          aria-hidden="true" />
      }

      {
        shouldLoad &&
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${isReady ? "opacity-100" : "opacity-0"}`}
          aria-label="Eclipze dashboard walkthrough"
          onCanPlay={() => setIsReady(true)}
          muted
          loop
          playsInline
          preload="none">
          <source src="/showcase.mp4" type="video/mp4" />
        </video>
      }
    </div>
  );
}
