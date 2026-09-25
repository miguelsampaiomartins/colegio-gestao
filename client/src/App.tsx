import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import Inventory from "@/pages/Inventory";
import NotFound from "@/pages/NotFound";
import Notes from "@/pages/Notes";
import Students from "@/pages/Students";
import Home from "@/pages/Home";
import { Route, Switch } from "wouter";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return <DashboardLayout><Switch><Route path="/" component={Home} /><Route path="/alunos" component={Students} /><Route path="/estoque" component={Inventory} /><Route path="/anotacoes" component={Notes} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></DashboardLayout>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
