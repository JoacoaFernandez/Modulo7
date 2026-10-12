import { SessionProvider } from "./presentation/context/session.context";
import { useSession } from "./presentation/hooks/use-session.hook";
import { LoginPage } from "./presentation/pages/login.page";
import { InstitutionalAnalyticsPage } from "./presentation/pages/institutional-analytics.page";

function AppShell() {
  const { user } = useSession();
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
