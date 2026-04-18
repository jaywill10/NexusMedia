import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Pages
import Dashboard from '@/pages/Dashboard';
import Discover from '@/pages/Discover';
import DiscoverDetail from '@/pages/DiscoverDetail';
import Requests from '@/pages/Requests';
import Movies from '@/pages/Movies';
import MovieDetail from '@/pages/MovieDetail';
import Series from '@/pages/Series';
import SeriesDetail from '@/pages/SeriesDetail';
import CalendarPage from '@/pages/CalendarPage';
import QueuePage from '@/pages/QueuePage';
import ActivityPage from '@/pages/ActivityPage';
import WantedPage from '@/pages/WantedPage';
import FilesPage from '@/pages/FilesPage';
import CollectionsPage from '@/pages/CollectionsPage';
import BlocklistPage from '@/pages/BlocklistPage';
import UsersPage from '@/pages/UsersPage';
import SettingsPage from '@/pages/SettingsPage';
import SystemPage from '@/pages/SystemPage';
import Login from '@/pages/Login';

const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const RequireAuth = ({ children }) => {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings } = useAuth();
  const location = useLocation();
  if (isLoadingPublicSettings || isLoadingAuth) return <LoadingScreen />;
  if (!isAuthenticated) {
    const from = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?from=${from}`} replace />;
  }
  return children;
};

const AuthenticatedApp = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/discover/:mediaType/:tmdbId" element={<DiscoverDetail />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/movies/:id" element={<MovieDetail />} />
        <Route path="/series" element={<Series />} />
        <Route path="/series/:id" element={<SeriesDetail />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/wanted" element={<WantedPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/blocklist" element={<BlocklistPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/system" element={<SystemPage />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
