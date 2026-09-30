import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  Outlet,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { configured } from "../config/app";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { WorkspaceProvider, useWorkspace } from "../hooks/useWorkspace";
import { Loading } from "../components/ui/Feedback";
import { LoginPage } from "../pages/LoginPage";
import { AppLayout } from "../components/layout/AppLayout";
const LookupPage = lazy(() => import("../pages/LookupPage"));
const ReportsPage = lazy(() => import("../pages/ReportsPage"));
const ImportPage = lazy(() => import("../pages/ImportPage"));
const CampaignsPage = lazy(() => import("../pages/CampaignsPage"));
const TeamPage = lazy(() => import("../pages/TeamPage"));
const AuditPage = lazy(() => import("../pages/AuditPage"));
const AccountPage = lazy(() => import("../pages/AccountPage"));
function AdminOnly() {
  return useWorkspace().profile.role === "admin" ? (
    <Outlet />
  ) : (
    <Navigate to="/" replace />
  );
}
function Authenticated() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <LoginPage />;
  return (
    <WorkspaceProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<LookupPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route element={<AdminOnly />}>
                <Route path="reports" element={<ReportsPage />} />
                <Route path="import" element={<ImportPage />} />
                <Route path="campaigns" element={<CampaignsPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="audit" element={<AuditPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </WorkspaceProvider>
  );
}
export default function App() {
  const { t } = useTranslation();
  if (!configured)
    return (
      <main className="setup-screen">
        <div className="panel">
          <h1>{t("auth.setupTitle")}</h1>
          <p>{t("auth.setupText")}</p>
        </div>
      </main>
    );
  return (
    <AuthProvider>
      <Authenticated />
    </AuthProvider>
  );
}
