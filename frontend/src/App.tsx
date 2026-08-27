import { SessionProvider, useSession } from "./presentation/context/session.context";
import { RoleSelectorPage } from "./presentation/pages/role-selector.page";
import { InstitutionalAnalyticsPage } from "./presentation/pages/institutional-analytics.page";

function AppShell() {
  const { role } = useSession();
  return role ? <InstitutionalAnalyticsPage /> : <RoleSelectorPage />;
}

function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}

export default App;
