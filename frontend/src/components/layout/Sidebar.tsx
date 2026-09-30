import { NavLink } from "react-router-dom";
import {
  Landmark,
  Search,
  ChartNoAxesCombined,
  Upload,
  CalendarDays,
  Users,
  History,
  LogOut,
  Settings,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { config } from "../../config/app";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useAuth } from "../../hooks/useAuth";
import { initials } from "../../lib/format";
const links = [
  { path: "/", key: "attention", icon: Search, admin: false },
  { path: "/reports", key: "reports", icon: ChartNoAxesCombined, admin: true },
  { path: "/import", key: "import", icon: Upload, admin: true },
  { path: "/campaigns", key: "campaigns", icon: CalendarDays, admin: true },
  { path: "/team", key: "team", icon: Users, admin: true },
  { path: "/audit", key: "audit", icon: History, admin: true },
];
export function Sidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const { profile } = useWorkspace();
  const { signOut } = useAuth();
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand">
        <span className="brand-symbol">
          {config.logo ? (
            <img src={config.logo} alt="" />
          ) : (
            <Landmark size={25} />
          )}
        </span>
        <span>
          <strong>{config.shortName}</strong>
          <small>{config.appName}</small>
        </span>
      </div>
      <div className="nav-label">{t("nav.operation")}</div>
      <nav aria-label={config.appName}>
        {links
          .filter((link) => !link.admin || profile.role === "admin")
          .map(({ path, key, icon: Icon }) => (
            <NavLink
              key={key}
              to={path}
              end={path === "/"}
              onClick={onNavigate}
              className={({ isActive }) => (isActive ? "selected" : "")}
            >
              <Icon size={19} />
              {t(`nav.${key}`)}
            </NavLink>
          ))}
      </nav>
      <div className="sidebar-footer">
        <NavLink
          to="/account"
          className="user-profile"
          onClick={onNavigate}
          aria-label={t("nav.account")}
        >
          <span className="avatar">{initials(profile.display_name)}</span>
          <span>
            <strong>{profile.display_name}</strong>
            <small>{t(`common.${profile.role}`)}</small>
          </span>
          <Settings size={16} />
        </NavLink>
        <button className="signout" onClick={() => void signOut()}>
          <LogOut size={17} />
          {t("common.signout")}
        </button>
      </div>
    </aside>
  );
}
