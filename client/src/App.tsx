import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/lib/auth-store";
import { SignInModal } from "@/components/SignInModal";
import { KeyModal } from "@/components/KeyModal";
import { BetaBanner } from "@/components/BetaBanner";
import LandingPage from "@/pages/landing";
import AppPage from "@/pages/app";
import PricingPage from "@/pages/pricing";
import NotFound from "@/pages/not-found";
import SettingsKeysPage from "@/pages/settings-keys";
import SettingsUsagePage from "@/pages/settings-usage";
import PrivacyPage from "@/pages/legal-privacy";
import TermsPage from "@/pages/legal-terms";
import ShareViewPage from "@/pages/share-view";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/app" component={AppPage} />
      <Route path="/app/orchestrate" component={AppPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/settings/keys" component={SettingsKeysPage} />
      <Route path="/settings/usage" component={SettingsUsagePage} />
      <Route path="/legal/privacy" component={PrivacyPage} />
      <Route path="/legal/terms" component={TermsPage} />
      <Route path="/share/:token" component={ShareViewPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <BetaBanner />
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
            <SignInModal />
            <KeyModal />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
