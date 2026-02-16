import { HashRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorkshopLogin from './pages/WorkshopLogin';
import Dashboard from './pages/Dashboard';
import TechnicianPortal from './pages/TechnicianPortal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<WorkshopLogin />} />
          <Route path="/WorkshopLogin" element={<WorkshopLogin />} />
          <Route path="/Dashboard" element={<Dashboard />} />
          <Route path="/TechnicianPortal" element={<TechnicianPortal />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}

export default App;