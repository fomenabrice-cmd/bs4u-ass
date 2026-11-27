import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";

const DiscoverLayout  = lazy(() => import("./components/layout/DiscoverLayout").then(m => ({ default: m.DiscoverLayout })));
const HomePage        = lazy(() => import("./pages/HomePage").then(m => ({ default: m.HomePage })));
const ProfilesPage    = lazy(() => import("./pages/ProfilesPage").then(m => ({ default: m.ProfilesPage })));
const ProfileDetail   = lazy(() => import("./pages/ProfileDetail").then(m => ({ default: m.ProfileDetail })));
const CreateProfile   = lazy(() => import("./pages/CreateProfile").then(m => ({ default: m.CreateProfile })));

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
        <Route path="/" element={<DiscoverLayout />}>
          <Route index element={<HomePage />} />
          <Route path="profils"              element={<ProfilesPage />} />
          <Route path="profils/:slug"        element={<ProfileDetail />} />
          <Route path="creer-mon-profil"     element={<CreateProfile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
