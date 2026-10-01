import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, Radio, WifiOff, HandHeart, LogOut } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useRealtime } from "../../hooks/useRealtime";
import { useAuth } from "../../hooks/useAuth";
import { Notice } from "../ui/Feedback";
import { config } from "../../config/app";
export function AppLayout() {
  const [open, setOpen] = useState(false);
  const { campaign, profile } = useWorkspace();
  const { signOut } = useAuth();
  const state = useRealtime(campaign?.id);
  const location = useLocation();
  const admin = profile.role === "admin";
  const title =
    location.pathname === "/reports"
      ? "Consultas e historial"
      : location.pathname === "/team"
        ? "Empleados"
        : location.pathname === "/account"
          ? "Mi cuenta"
          : location.pathname === "/import"
            ? "Cargar padrón"
            : "Jornadas";
  return (
    <div className={admin ? "workspace" : "operator-workspace"}>
      <a href="#main" className="skip-link">
        Ir al contenido
      </a>
      {admin && (
        <>
          <Sidebar open={open} onNavigate={() => setOpen(false)} />
          {open && (
            <button
              className="sidebar-scrim"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
            />
          )}
        </>
      )}
      <div className="workspace-body">
        <header className="topbar">
          {admin ? (
            <>
              <button
                className="icon-button mobile-toggle"
                aria-label="Abrir menú"
                onClick={() => setOpen(!open)}
              >
                <Menu />
              </button>
              <div className="breadcrumb">
                Administración <span>/</span> <strong>{title}</strong>
              </div>
            </>
          ) : (
            <div className="operator-brand">
              <HandHeart size={26} />
              <strong>
                {config.shortName}
                <small>Control de entregas</small>
              </strong>
            </div>
          )}
          <div className="topbar-right">
            <span
              className={`connection ${state}`}
              title={
                state === "live"
                  ? "Actualización en tiempo real"
                  : "Actualización automática periódica"
              }
            >
              {state === "offline" ? (
                <WifiOff size={15} />
              ) : (
                <Radio size={15} />
              )}
              <span>
                {state === "offline"
                  ? "Sin conexión"
                  : state === "live"
                    ? "En tiempo real"
                    : "Actualización automática"}
              </span>
            </span>
            {admin ? (
              <span className="today-label">
                {new Intl.DateTimeFormat("es-GT", {
                  timeZone: config.timezone,
                  day: "numeric",
                  month: "long",
                }).format(new Date())}
              </span>
            ) : (
              <button
                className="signout compact"
                onClick={() => void signOut()}
                aria-label="Cerrar sesión"
              >
                <LogOut size={17} />
                <span>Salir</span>
              </button>
            )}
          </div>
        </header>
        <main id="main" className="main-content">
          {state === "offline" && (
            <Notice tone="warning">
              Sin conexión. No se pueden confirmar entregas.
            </Notice>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
