import { SessionProvider } from "./presentation/context/session.context";
import { useSession } from "./presentation/hooks/use-session.hook";
import { LoadingScreen } from "./presentation/components/loading-screen.component";
import { LoginPage } from "./presentation/pages/login.page";
import { InstitutionalAnalyticsPage } from "./presentation/pages/institutional-analytics.page";

function AppShell() {
  const { user, isRestoring } = useSession();
  // Mientras se intenta restaurar la sesión no se muestra el login (evita el parpadeo).
  if (isRestoring) return <LoadingScreen />;
  return user ? <InstitutionalAnalyticsPage user={user} /> : <LoginPage />;
}

function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}

export default App;
