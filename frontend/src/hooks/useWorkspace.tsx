import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Bootstrap, Campaign } from "@mazate/contracts";
import { api } from "../lib/api";
import { Loading, ErrorNotice } from "../components/ui/Feedback";
import { Button } from "../components/ui/Button";
import { useAuth } from "./useAuth";
import { useTranslation } from "react-i18next";
import { config } from "../config/app";
interface WorkspaceValue extends Bootstrap {
  campaign: Campaign | null;
  setCampaign: (id: string) => void;
}
const Context = createContext<WorkspaceValue | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState("");
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const query = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => api<Bootstrap>("/bootstrap"),
    refetchInterval: config.refreshMs,
  });
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <div className="auth-error panel stack">
        <ErrorNotice error={query.error} />
        <Button onClick={() => void query.refetch()}>
          {t("common.retry")}
        </Button>
        <Button variant="secondary" onClick={() => void signOut()}>
          {t("common.signout")}
        </Button>
      </div>
    );
  const data = query.data;
  const campaign =
    data.campaigns.find((c) => c.id === selected) ??
    data.campaigns.find((c) => c.status === "active" && !c.shift_closed_at) ??
    data.campaigns[0] ??
    null;
  return (
    <Context.Provider value={{ ...data, campaign, setCampaign: setSelected }}>
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider missing");
  return value;
}
