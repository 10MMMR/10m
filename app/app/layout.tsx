import { AppShell } from "./_components/app-shell";
import { ProtectedAppRoute } from "./_components/protected-app-route";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ProtectedAppRoute>
      <AppShell>{children}</AppShell>
    </ProtectedAppRoute>
  );
}
