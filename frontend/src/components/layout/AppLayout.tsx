import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, MapPin, Radio, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useRealtime } from "../../hooks/useRealtime";
import { Notice } from "../ui/Feedback";
export function AppLayout() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { campaign, campaigns, setCampaign } = useWorkspace();
  const state = useRealtime(campaign?.id);
  return (
    <div className="workspace">
      <a href="#main" className="skip-link">
        {t("common.skip")}
      </a>
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      {open ? (
        <button
          className="sidebar-scrim"
          onClick={() => setOpen(false)}
          aria-label={t("common.close")}
        />
      ) : null}
      <div className="workspace-body">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label={t("common.menu")}
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </button>
          <label className="campaign-picker">
            <span>{t("common.campaign")}</span>
            <select
              value={campaign?.id ?? ""}
              onChange={(e) => setCampaign(e.target.value)}
              aria-label={t("common.campaign")}
            >
              {!campaign ? (
                <option value="">{t("common.select")}</option>
              ) : null}
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="topbar-right">
            {campaign?.point_name ? (
              <span className="point-label">
                <MapPin size={16} />
                {campaign.point_name}
              </span>
            ) : null}
            <span className={`connection ${state}`}>
              {state === "offline" ? (
                <WifiOff size={16} />
              ) : (
                <Radio size={16} />
              )}
              <span>{t(`connection.${state}`)}</span>
            </span>
          </div>
        </header>
        <main id="main" className="main-content">
          {state === "offline" ? (
            <Notice tone="warning">{t("connection.offline")}</Notice>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
