import { useEffect } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { AppShell } from "./components/AppShell";
import { AuthPage } from "./pages/AuthPage";
import { ProfilePage } from "./pages/ProfilePage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { AccountPage } from "./pages/AccountPage";
import "./styles.css";
import { SyncProvider } from "./sync/SyncContext";
import { NutritionPage } from "./nutrition/NutritionPage";
import { SyncPage } from "./pages/SyncPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { PrivacyReceiptPage } from "./pages/PrivacyReceiptPage";
import { TrainingPage } from "./training/TrainingPage";

import { ProgressPage } from "./progress/ProgressPage";
import { RemindersPage, ReminderScheduler } from "./progress/RemindersPage";

function Protected() {
  const { account, loading } = useAuth();
  const { t } = useLanguage();
  if (loading)
    return (
      <div className="loading-screen" role="status">
        {t("loading")}
      </div>
    );
  return account ? <Outlet /> : <Navigate to="/login" replace />;
}
function Ready() {
  const { account } = useAuth();
  return account?.profile.display_name ? (
    <Outlet />
  ) : (
    <Navigate to="/onboarding" replace />
  );
}
function Entry() {
  const { account, loading } = useAuth();
  const { t } = useLanguage();
  if (loading)
    return (
      <div className="loading-screen" role="status">
        {t("loading")}
      </div>
    );
  return (
    <Navigate
      to={
        account
          ? account.profile.display_name
            ? "/app"
            : "/onboarding"
          : "/login"
      }
      replace
    />
  );
}
function RouteFocus() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  useEffect(() => {
    document.title = `TrainFuel · ${pathname.includes("profile") || pathname.includes("onboarding") ? t("profile") : pathname.includes("account") ? t("account") : pathname.includes("/app") ? t("overview") : t("brandTag")}`;
    const frame = requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("h1")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [pathname, t("language")]);
  return null;
}
function NotFound() {
  const { t } = useLanguage();
  return (
    <main className="loading-screen">
      <h1 tabIndex={-1}>{t("notFound")}</h1>
      <Link to="/">{t("goHome")}</Link>
    </main>
  );
}
export function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <SyncProvider>
          <BrowserRouter>
            <RouteFocus />
            <ReminderScheduler />
            <Routes>
              <Route path="/" element={<Entry />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route
                path="/forgot-password"
                element={<AuthPage mode="recovery" />}
              />
              <Route
                path="/reset-password"
                element={<AuthPage mode="reset" />}
              />
              <Route path="/privacy/request" element={<PrivacyReceiptPage />} />
              <Route element={<Protected />}>
                <Route element={<AppShell />}>
                  <Route
                    path="/onboarding"
                    element={<ProfilePage onboarding />}
                  />
                  <Route element={<Ready />}>
                    <Route path="/app" element={<WorkspacePage />} />
                    <Route path="/app/profile" element={<ProfilePage />} />
                    <Route path="/app/account" element={<AccountPage />} />
                    <Route path="/app/privacy" element={<PrivacyPage />} />
                    <Route path="/app/nutrition" element={<NutritionPage />} />
                    <Route path="/app/progress" element={<ProgressPage />} />
                    <Route path="/app/reminders" element={<RemindersPage />} />
                    <Route path="/app/sync" element={<SyncPage />} />
                    <Route path="/app/training" element={<TrainingPage />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SyncProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
