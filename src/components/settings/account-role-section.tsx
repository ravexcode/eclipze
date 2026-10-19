"use client";

import { useState } from "react";
import { IconCode, IconUser } from "@tabler/icons-react";

import Button from "@/components/ui/button";
import { ACCOUNT_ROLE_OPTIONS } from "@/constants/account-roles";
import type { SessionUser, UserRole } from "@/types/user";
import { apiFetch } from "@/utils/api-fetch";
import { errorMessage, readJson } from "@/utils/json-payload";
import { setSessionUser } from "@/utils/session";
import SettingsFeedback from "./settings-feedback";
import SettingsRow from "./settings-row";
import SettingsSection from "./settings-section";

export default function AccountRoleSection(props: {
  user: SessionUser;
  onChanged(user: SessionUser): void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);

  const changeRole = async (role: UserRole) => {
    setError(null);
    setPendingRole(role);

    try {
      const response = await apiFetch("/api/account/role", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const payload = await readJson(response) as { user?: SessionUser } | null;

      if (!response.ok || !payload?.user) {
        setError(errorMessage(payload, "Unable to change your role."));
        return;
      }

      setSessionUser(payload.user);
      props.onChanged(payload.user);
      window.dispatchEvent(new Event("user-updated"));
    } catch {
      setError("Unable to change your role.");
    } finally {
      setPendingRole(null);
    }
  };

  return (
    <SettingsSection
      title="Role"
      description="Your role sets which workspace tools you see. You can switch at any time.">
      {ACCOUNT_ROLE_OPTIONS.map(option => {
        const isCurrent = props.user.role === option.role;

        return (
          <SettingsRow
            key={option.role}
            title={option.label}
            detail={option.description}
            leading={option.role === "DEVELOPER"
              ? <IconCode size={16} strokeWidth={1.7} />
              : <IconUser size={16} strokeWidth={1.7} />}
            action={(
              <Button
                type="button"
                variant="secondary"
                onClick={() => void changeRole(option.role)}
                disabled={isCurrent || pendingRole !== null}>
                {isCurrent ? "Current" : pendingRole === option.role ? "Switching..." : "Switch"}
              </Button>
            )} />
        );
      })}
      <SettingsFeedback error={error} message={null} />
    </SettingsSection>
  );
}
