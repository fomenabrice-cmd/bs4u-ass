import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { useAuth } from "./hooks/useAuth";
import { LoadingScreen } from "./components/ui/LoadingScreen";

// Lazy-loading des pages pour le code-splitting
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const ClientsList = lazy(() => import("./pages/clients/ClientsList").then((m) => ({ default: m.ClientsList })));
const FournisseursList = lazy(() => import("./pages/fournisseurs/FournisseursList").then((m) => ({ default: m.FournisseursList })));
const ClientDetail = lazy(() => import("./pages/clients/ClientDetail").then((m) => ({ default: m.ClientDetail })));
const OrdersList = lazy(() => import("./pages/orders/OrdersList").then((m) => ({ default: m.OrdersList })));
const OrderNew = lazy(() => import("./pages/orders/OrderNew").then((m) => ({ default: m.OrderNew })));
const OrderDetail = lazy(() => import("./pages/orders/OrderDetail").then((m) => ({ default: m.OrderDetail })));
const PrintQueue = lazy(() => import("./pages/print/PrintQueue").then((m) => ({ default: m.PrintQueue })));
const PrintCalculator = lazy(() => import("./pages/print/PrintCalculator").then((m) => ({ default: m.PrintCalculator })));
const POS = lazy(() => import("./pages/pos/POS").then((m) => ({ default: m.POS })));
const CashSession = lazy(() => import("./pages/cash/CashSession").then((m) => ({ default: m.CashSession })));
const CashHistory = lazy(() => import("./pages/cash/CashHistory").then((m) => ({ default: m.CashHistory })));
const Comptes     = lazy(() => import("./pages/cash/Comptes").then((m) => ({ default: m.Comptes })));
const MomoBoard = lazy(() => import("./pages/momo/MomoBoard").then((m) => ({ default: m.MomoBoard })));
const MomoEntry = lazy(() => import("./pages/momo/MomoEntry").then((m) => ({ default: m.MomoEntry })));
const SecretariatList = lazy(() => import("./pages/secretariat/SecretariatList").then((m) => ({ default: m.SecretariatList })));
const DocumentEditor = lazy(() => import("./pages/secretariat/DocumentEditor").then((m) => ({ default: m.DocumentEditor })));
const StockDashboard = lazy(() => import("./pages/stock/StockDashboard").then((m) => ({ default: m.StockDashboard })));
const FinanceInvoices = lazy(() => import("./pages/finance/FinanceInvoices").then((m) => ({ default: m.FinanceInvoices })));
const FinanceDashboard = lazy(() => import("./pages/finance/FinanceDashboard").then((m) => ({ default: m.FinanceDashboard })));
const FinanceMargins = lazy(() => import("./pages/finance/FinanceMargins").then((m) => ({ default: m.FinanceMargins })));
const FinanceCommissions = lazy(() => import("./pages/finance/FinanceCommissions").then((m) => ({ default: m.FinanceCommissions })));
const FinanceCapital = lazy(() => import("./pages/finance/FinanceCapital").then((m) => ({ default: m.FinanceCapital })));
const FinanceDepreciation = lazy(() => import("./pages/finance/FinanceDepreciation").then((m) => ({ default: m.FinanceDepreciation })));
const FinanceProfitability = lazy(() => import("./pages/finance/FinanceProfitability").then((m) => ({ default: m.FinanceProfitability })));
const FinanceReports = lazy(() => import("./pages/finance/FinanceReports").then((m) => ({ default: m.FinanceReports })));
const FinanceSettings = lazy(() => import("./pages/finance/FinanceSettings").then((m) => ({ default: m.FinanceSettings })));
const FinanceReserves = lazy(() => import("./pages/finance/FinanceReserves").then((m) => ({ default: m.FinanceReserves })));
const FinanceLoans = lazy(() => import("./pages/finance/FinanceLoans").then((m) => ({ default: m.FinanceLoans })));
const FinanceAssets = lazy(() => import("./pages/finance/FinanceAssets").then((m) => ({ default: m.FinanceAssets })));
const FinanceJournal = lazy(() => import("./pages/finance/FinanceJournal").then((m) => ({ default: m.FinanceJournal })));
const FinanceClosings = lazy(() => import("./pages/finance/FinanceClosings").then((m) => ({ default: m.FinanceClosings })));
const FinanceTreasury = lazy(() => import("./pages/finance/FinanceTreasury").then((m) => ({ default: m.FinanceTreasury })));
const Reports = lazy(() => import("./pages/reports/Reports").then((m) => ({ default: m.Reports })));
const DevisList = lazy(() => import("./pages/devis/DevisList").then((m) => ({ default: m.DevisList })));
const DevisNew = lazy(() => import("./pages/devis/DevisNew").then((m) => ({ default: m.DevisNew })));
const ClientNew = lazy(() => import("./pages/clients/ClientNew").then((m) => ({ default: m.ClientNew })));
const ProduitsList = lazy(() => import("./pages/produits/ProduitsList").then((m) => ({ default: m.ProduitsList })));
const SalesHistory = lazy(() => import("./pages/ventes/SalesHistory").then((m) => ({ default: m.SalesHistory })));
const FinanceEncaissements = lazy(() => import("./pages/finance/FinanceEncaissements").then((m) => ({ default: m.FinanceEncaissements })));
const FinanceDepenses = lazy(() => import("./pages/finance/FinanceDepenses").then((m) => ({ default: m.FinanceDepenses })));
const FormationsList = lazy(() => import("./pages/formations/FormationsList").then((m) => ({ default: m.FormationsList })));
const ProjetsList = lazy(() => import("./pages/projets/ProjetsList").then((m) => ({ default: m.ProjetsList })));
const AbonnementsList = lazy(() => import("./pages/abonnements/AbonnementsList").then((m) => ({ default: m.AbonnementsList })));
const ReunionsIA = lazy(() => import("./pages/reunions/ReunionsIA").then((m) => ({ default: m.ReunionsIA })));
const MonActivite = lazy(() => import("./pages/MonActivite").then((m) => ({ default: m.MonActivite })));
const ProfilPage  = lazy(() => import("./pages/ProfilPage").then((m) => ({ default: m.ProfilPage })));
const PreferencesPage = lazy(() => import("./pages/PreferencesPage").then((m) => ({ default: m.PreferencesPage })));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/connexion" replace />;
  return <>{children}</>;
}

export default function App() {
  const { loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Routes publiques */}
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/inscription" element={<SignupPage />} />

        {/* Routes protégées dans l'AppShell */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<ClientsList />} />
          <Route path="clients/nouveau" element={<ClientNew />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="fournisseurs" element={<FournisseursList />} />
          <Route path="commandes" element={<OrdersList />} />
          <Route path="commandes/nouvelle" element={<OrderNew />} />
          <Route path="commandes/:id" element={<OrderDetail />} />
          <Route path="impression" element={<PrintQueue />} />
          <Route path="impression/calculateur" element={<PrintCalculator />} />
          <Route path="vente" element={<POS />} />
          <Route path="caisse" element={<CashSession />} />
          <Route path="caisse/historique" element={<CashHistory />} />
          <Route path="comptes" element={<Comptes />} />
          <Route path="mobile-money" element={<MomoBoard />} />
          <Route path="mobile-money/nouvelle" element={<MomoEntry />} />
          <Route path="secretariat" element={<SecretariatList />} />
          <Route path="secretariat/:id" element={<DocumentEditor />} />
          <Route path="stocks" element={<StockDashboard />} />
          <Route path="finance" element={<FinanceDashboard />} />
          <Route path="finance/marges" element={<FinanceMargins />} />
          <Route path="finance/commissions" element={<FinanceCommissions />} />
          <Route path="finance/reserves" element={<FinanceReserves />} />
          <Route path="finance/emprunts" element={<FinanceLoans />} />
          <Route path="finance/capital" element={<FinanceCapital />} />
          <Route path="finance/immobilisations" element={<FinanceAssets />} />
          <Route path="finance/amortissements" element={<FinanceDepreciation />} />
          <Route path="finance/tresorerie" element={<FinanceTreasury />} />
          <Route path="finance/journal" element={<FinanceJournal />} />
          <Route path="finance/cloture" element={<FinanceClosings />} />
          <Route path="finance/rentabilite" element={<FinanceProfitability />} />
          <Route path="finance/rapports-financiers" element={<FinanceReports />} />
          <Route path="finance/parametres-finance" element={<FinanceSettings />} />
          <Route path="finance/factures" element={<FinanceInvoices />} />
          <Route path="finance/encaissements" element={<FinanceEncaissements />} />
          <Route path="finance/depenses" element={<FinanceDepenses />} />
          <Route path="rapports" element={<Reports />} />
          <Route path="devis" element={<DevisList />} />
          <Route path="devis/nouveau" element={<DevisNew />} />
          <Route path="produits" element={<ProduitsList />} />
          <Route path="historique-ventes" element={<SalesHistory />} />
          <Route path="formations" element={<FormationsList />} />
          <Route path="projets" element={<ProjetsList />} />
          <Route path="abonnements" element={<AbonnementsList />} />
          <Route path="reunions" element={<ReunionsIA />} />
          <Route path="mon-activite" element={<MonActivite />} />
          <Route path="profil" element={<ProfilPage />} />
          <Route path="parametres-locaux" element={<PreferencesPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
