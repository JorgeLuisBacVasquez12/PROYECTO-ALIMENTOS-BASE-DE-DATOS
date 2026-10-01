import { NavLink } from "react-router-dom";
import {
  HandHeart,
  CalendarDays,
  Users,
  ChartNoAxesCombined,
  LogOut,
  ArrowUpRight,
} from "lucide-react";
import { config } from "../../config/app";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useAuth } from "../../hooks/useAuth";
import { initials } from "../../lib/format";
const links = [
  { path: "/", label: "Jornadas", icon: CalendarDays },
  {
    path: "/reports",
    label: "Consultas e historial",
    icon: ChartNoAxesCombined,
  },
  { path: "/team", label: "Empleados", icon: Users },
];
export function Sidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  const { profile } = useWorkspace();
  const { signOut } = useAuth();
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand">
        <span className="brand-symbol">
          {config.logo ? (
            <img src={config.logo} alt="" />
          ) : (
            <HandHeart size={26} />
          )}
        </span>
        <span>
          <strong>{config.shortName}</strong>
          <small>Entregas con propósito</small>
        </span>
      </div>
      <div className="nav-label">ADMINISTRACIÓN</div>
      <nav aria-label="Administración">
        {links.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? "selected" : "")}
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-note">
        <span className="note-mark">
          <HandHeart size={23} />
        </span>
        <strong>Cada entrega cuenta.</strong>
        <p>Personas, puntos y jornadas trabajando juntos.</p>
        <span className="note-line" />
      </div>
      <div className="sidebar-footer">
        <NavLink
          to="/account"
          className="user-profile"
          onClick={onNavigate}
          aria-label="Mi cuenta"
        >
          <span className="avatar">{initials(profile.display_name)}</span>
          <span>
            <strong>{profile.display_name}</strong>
            <small>Administrador</small>
          </span>
          <ArrowUpRight size={16} />
        </NavLink>
        <button className="signout" onClick={() => void signOut()}>
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
