// Set up
"use client";

interface Props {
  selected: SelectedSection;
  user?: User
  router: AppRouterInstance
};

// Next imports
import Link from "next/link";

// React imports
import { useEffect, useMemo, useRef, useState } from "react";

// Icons
import {
  IconLayoutSidebar,
  IconLock,
  IconSearch
} from "@tabler/icons-react";

// Components
import {
  labels,
  type SelectedSection
} from "@/constants/components/sidebar-labels";

// Components imports
import UserProfile from "./ui/profile";

// Types
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { User } from "@/types/user";

// Utils
import { canAccessErd } from "@/utils/erd";

// Main content
export default function Sidebar(props: Props) {
  // Sidebar definitions
  const [width, setWidth] = useState<number>(300);
  const [bgColor, setBgColor] = useState<string>("#060606");
  const [expanded, setExpanded] = useState(true);
  const [searchSelected, setSearchSelected] = useState(false);

  // Components
  const search_field = useRef<HTMLInputElement>(null);
  const [search_query, setSearchQuery] = useState("");

  // Constants
  const labels_data = labels(props.selected);

  const filtered_labels = useMemo(() => {
    const normalized_query = search_query.trim().toLowerCase();

    if (!normalized_query) return labels_data;

    return labels_data.filter((label) =>
      label.label.toLowerCase().includes(normalized_query)
    );
  }, [labels_data, search_query]);

  //⌘K key listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";

      if (!isSearchShortcut) return;

      event.preventDefault();
      search_field.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleSidebar = () => {
    setExpanded(prev => !prev);
    setWidth(prev => prev === 300 ? 40 : 300);
    setBgColor(prev => prev === "#060606" ? "#00000000" : "#060606");
  }

  return (
    <aside
      className="h-full shrink-0 flex flex-col items-center justify-start pb-2 pt-7 gap-2 relative px-3 transition-[width,background-color] duration-200"
      style={{
        width: `${width}px`,
        backgroundColor: bgColor,
      }}>
      {
        expanded ?
          <>
            <button
              type="button"
              aria-label="Collapse navigation"
              className="cursor-pointer text-foreground-off hover:text-foreground transition-colors duration-200 p-1 px-4 pb-3 ml-auto"
              onClick={toggleSidebar}>
              <IconLayoutSidebar
                size={20}
                stroke={1} />
            </button>

            {/* Search field */}
            <section
              className={"w-full rounded-lg duration-200 flex justify-center items-center text-sm px-5 gap-2 border my-2 " + (searchSelected ? "border-accent" : "border-background-focus")}>
              <input
                onFocus={() => setSearchSelected(true)}
                onBlur={() => setSearchSelected(false)}
                ref={search_field}
                type="text"
                value={search_query}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Search navigation"
                className="min-w-0 flex-1 h-full py-2 text-start placeholder:text-foreground-off text-foreground outline-hidden"
                placeholder="Search" />

              <p
                className="shrink-0 text-foreground-off">
                ⌘K
              </p>
              <IconSearch
                size={15} />
            </section>

            {/* Input labels */}
            <section
              className="w-full flex flex-col gap-1 text-sm">
              {
                filtered_labels.map((label) => {
                  //TODO: Actualizar la restriccion a algo mas como "Tiene rango?"
                  const isLocked = label.isPremium === true && !canAccessErd(props.user);

                  if (isLocked) {
                    return (
                      <Link
                        key={label.redirection}
                        href={props.user?.role === "DEVELOPER" ? "/billing" : "/profile/settings"}
                        title="Requires the Developer role on a paid plan"
                        className="w-full flex gap-2 items-center justify-start px-3 py-1.5 rounded-md text-foreground-off opacity-50 grayscale hover:bg-background-focus/50 hover:opacity-80">
                        {label.icon}

                        {label.label}

                        <IconLock
                          size={13}
                          strokeWidth={1.8}
                          className="ml-auto" />
                      </Link>
                    );
                  }

                  return (
                    <Link
                      key={label.redirection}
                      href={label.redirection}
                      className={"w-full flex gap-2 items-center justify-start px-3 py-1.5 rounded-md " + (label.selected ? "bg-background-focus" : "hover:bg-background-focus/50 text-foreground-off")}>
                      {label.icon}

                      {label.label}
                    </Link>
                  );
                })
              }
              {filtered_labels.length === 0 ? (
                <p className="px-3 py-2 text-foreground-off" role="status">
                  No navigation options found.
                </p>
              ) : null}
            </section>

            {props.user ? (
              <UserProfile profile={props.user} />
            ) : null}
          </> :
          <button
            type="button"
            aria-label="Expand navigation"
            className="cursor-pointer text-foreground-off hover:text-foreground transition-colors duration-200"
            onClick={toggleSidebar}>
            <IconLayoutSidebar
              size={18}
              stroke={1.5} />
          </button>
      }

    </aside>
  );
}
