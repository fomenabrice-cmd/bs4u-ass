import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";

const MemberShell        = lazy(() => import("./components/layout/MemberShell").then(m => ({ default: m.MemberShell })));
const MemberDashboard    = lazy(() => import("./pages/MemberDashboard").then(m => ({ default: m.MemberDashboard })));
const MemberProfile      = lazy(() => import("./pages/MemberProfile").then(m => ({ default: m.MemberProfile })));
const MemberMembership   = lazy(() => import("./pages/MemberMembership").then(m => ({ default: m.MemberMembership })));
const MemberDocuments    = lazy(() => import("./pages/MemberDocuments").then(m => ({ default: m.MemberDocuments })));
const MemberTraining     = lazy(() => import("./pages/MemberTraining").then(m => ({ default: m.MemberTraining })));
const LoginPage          = lazy(() => import("./pages/LoginPage").then(m => ({ default: m.LoginPage })));

function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-2 border-[#E2E8E3] border-t-[#075B32] rounded-full animate-spin" />
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/" element={<MemberShell />}>
          <Route index element={<Navigate to="/tableau-de-bord" replace />} />
          <Route path="tableau-de-bord" element={<MemberDashboard />} />
          <Route path="profil"          element={<MemberProfile />} />
          <Route path="adhesion"        element={<MemberMembership />} />
          <Route path="documents"       element={<MemberDocuments />} />
          <Route path="formation"       element={<MemberTraining />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
