import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";

const AdminShell = lazy(() => import("./components/layout/AdminShell").then(m => ({ default: m.AdminShell })));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const UsersPage = lazy(() => import("./pages/UsersPage").then(m => ({ default: m.UsersPage })));
const RolesPage = lazy(() => import("./pages/RolesPage").then(m => ({ default: m.RolesPage })));
const AuditPage = lazy(() => import("./pages/AuditPage").then(m => ({ default: m.AuditPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const FeatureFlagsPage = lazy(() => import("./pages/FeatureFlagsPage").then(m => ({ default: m.FeatureFlagsPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then(m => ({ default: m.LoginPage })));

function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#063A22]">
      <div className="w-8 h-8 border-2 border-[#D6A52B]/30 border-t-[#D6A52B] rounded-full animate-spin" />
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/" element={<AdminShell />}>
          <Route index element={<Navigate to="/tableau-de-bord" replace />} />
          <Route path="tableau-de-bord" element={<AdminDashboard />} />
          <Route path="utilisateurs"    element={<UsersPage />} />
          <Route path="roles"           element={<RolesPage />} />
          <Route path="audit"           element={<AuditPage />} />
          <Route path="parametres"      element={<SettingsPage />} />
          <Route path="feature-flags"   element={<FeatureFlagsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
