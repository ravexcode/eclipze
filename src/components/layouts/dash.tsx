"use client";

import { useEffect, useState, type ReactNode } from "react";

import Sidebar from "@/components/sidebar";

import type { UserProfile } from "@/types/user";

import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { usePathname } from "next/navigation";

import {
  getCachedSessionUser,
  getSessionUser,
  toUserProfile,
} from "@/utils/session";

import type { SelectedSection } from "@/constants/components/sidebar-labels";

interface Props {
  current: SelectedSection;
  router: AppRouterInstance;
  children?: ReactNode;
}

const USER_UPDATED_EVENT = "user-updated";

export default function DashLayout(props: Props) {
  const pathname = usePathname();
  // Each page mounts its own layout, so the cached user prevents a skeleton flash on navigation.
  const [user, setUser] = useState<UserProfile | undefined>(() => {
    const cachedUser = getCachedSessionUser();

    return cachedUser ? toUserProfile(cachedUser) : undefined;
  });
  const [userLoadFailed, setUserLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const handleUserUpdated = () => {
      setReloadToken(previous => previous + 1);
    };

    window.addEventListener(USER_UPDATED_EVENT, handleUserUpdated);

    return () => {
      window.removeEventListener(USER_UPDATED_EVENT, handleUserUpdated);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentUser = async () => {
      try {
        const sessionUser = await getSessionUser();

        if (!sessionUser) {
          props.router.replace("/auth/signin");
          return;
        }

        if (cancelled) return;

        setUser(toUserProfile(sessionUser));
        setUserLoadFailed(false);
      } catch {
        // A failed request must not leave the navigation stuck behind its skeleton.
        if (!cancelled) setUserLoadFailed(true);
      }
    };

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [pathname, props.router, reloadToken]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <Sidebar
        selected={props.current}
        user={user}
        isLoadingUser={!user && !userLoadFailed}
        router={props.router} />
      <div className="relative h-full min-w-0 flex-1 overflow-y-auto">
        {props.children}
      </div>
    </div>
  );
}
