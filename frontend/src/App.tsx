import { BrowserRouter, Route, Routes } from 'react-router';
import { ToastProvider } from './components/ui/Toast';
import { AdminDashboardPage } from './features/admin/AdminDashboardPage';
import { IncidentTypesPage } from './features/admin/IncidentTypesPage';
import { RespondersPage } from './features/admin/RespondersPage';
import { SystemStatisticsPage } from './features/admin/SystemStatisticsPage';
import { UsersPage } from './features/admin/UsersPage';
import { AuthProvider } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { CitizenDashboardPage } from './features/citizen/CitizenDashboardPage';
import { CitizenIncidentPage } from './features/citizen/CitizenIncidentPage';
import { MyIncidentsPage } from './features/citizen/MyIncidentsPage';
import { ReportIncidentPage } from './features/citizen/ReportIncidentPage';
import { DashboardPage } from './features/operator/DashboardPage';
import { IncidentQueuePage } from './features/operator/IncidentQueuePage';
import { IncidentReviewPage } from './features/operator/IncidentReviewPage';
import { MapViewPage } from './features/operator/MapViewPage';
import { AssignmentsPage } from './features/responder/AssignmentsPage';
import { ResponderDashboardPage } from './features/responder/ResponderDashboardPage';
import { ResponderIncidentPage } from './features/responder/ResponderIncidentPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { GuestOnly, HomeRedirect, RequireAuth, RequireRole } from './routes/guards';

/**
 * Every page of the app. Visitors see the landing page, login and
 * registration; logged-in users go to their role's section. RequireRole
 * sends users who open another role's page back to their own home page.
 */
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route index element={<LandingPage />} />
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>
            </Route>

            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                {/* The login stage's dashboard address: sends each role to its own home page */}
                <Route path="dashboard" element={<HomeRedirect />} />

                <Route path="citizen" element={<RequireRole roles={['CITIZEN']} />}>
                  <Route index element={<CitizenDashboardPage />} />
                  <Route path="report" element={<ReportIncidentPage />} />
                  <Route path="incidents" element={<MyIncidentsPage />} />
                  <Route path="incidents/:id" element={<CitizenIncidentPage />} />
                </Route>

                <Route path="operator" element={<RequireRole roles={['OPERATOR']} />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="incidents" element={<IncidentQueuePage basePath="/operator" />} />
                  <Route path="incidents/:id" element={<IncidentReviewPage basePath="/operator" />} />
                  <Route path="map" element={<MapViewPage basePath="/operator" />} />
                </Route>

                <Route path="responder" element={<RequireRole roles={['RESPONDER']} />}>
                  <Route index element={<ResponderDashboardPage />} />
                  <Route path="assignments" element={<AssignmentsPage />} />
                  <Route path="incidents/:id" element={<ResponderIncidentPage />} />
                </Route>

                <Route path="admin" element={<RequireRole roles={['ADMIN']} />}>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="incidents" element={<IncidentQueuePage basePath="/admin" />} />
                  <Route path="incidents/:id" element={<IncidentReviewPage basePath="/admin" />} />
                  <Route path="map" element={<MapViewPage basePath="/admin" />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="responders" element={<RespondersPage />} />
                  <Route path="incident-types" element={<IncidentTypesPage />} />
                  <Route path="statistics" element={<SystemStatisticsPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
