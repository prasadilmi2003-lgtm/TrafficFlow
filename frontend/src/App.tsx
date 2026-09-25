import { BrowserRouter, Route, Routes } from 'react-router';
import { RespondersPage } from './features/admin/RespondersPage';
import { IncidentTypesPage } from './features/admin/IncidentTypesPage';
import { SystemOverviewPage } from './features/admin/SystemOverviewPage';
import { UsersPage } from './features/admin/UsersPage';
import { AuthProvider } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { CitizenIncidentPage } from './features/citizen/CitizenIncidentPage';
import { MyIncidentsPage } from './features/citizen/MyIncidentsPage';
import { ReportIncidentPage } from './features/citizen/ReportIncidentPage';
import { DashboardPage } from './features/operator/DashboardPage';
import { IncidentQueuePage } from './features/operator/IncidentQueuePage';
import { IncidentReviewPage } from './features/operator/IncidentReviewPage';
import { MapViewPage } from './features/operator/MapViewPage';
import { AssignmentsPage } from './features/responder/AssignmentsPage';
import { ResponderIncidentPage } from './features/responder/ResponderIncidentPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { GuestOnly, HomeRedirect, RequireAuth, RequireRole } from './routes/guards';

/**
 * Every page of the app. Each role has its own section; RequireRole sends
 * users who open another role's page back to their own home page.
 */
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<HomeRedirect />} />
              {/* The login stage's dashboard address: now sends each role to its own home page */}
              <Route path="dashboard" element={<HomeRedirect />} />

              <Route path="citizen" element={<RequireRole roles={['CITIZEN']} />}>
                <Route index element={<MyIncidentsPage />} />
                <Route path="report" element={<ReportIncidentPage />} />
                <Route path="incidents/:id" element={<CitizenIncidentPage />} />
              </Route>

              <Route path="operator" element={<RequireRole roles={['OPERATOR']} />}>
                <Route index element={<DashboardPage />} />
                <Route path="incidents" element={<IncidentQueuePage basePath="/operator" />} />
                <Route path="incidents/:id" element={<IncidentReviewPage basePath="/operator" />} />
                <Route path="map" element={<MapViewPage basePath="/operator" />} />
              </Route>

              <Route path="responder" element={<RequireRole roles={['RESPONDER']} />}>
                <Route index element={<AssignmentsPage />} />
                <Route path="incidents/:id" element={<ResponderIncidentPage />} />
              </Route>

              <Route path="admin" element={<RequireRole roles={['ADMIN']} />}>
                <Route index element={<SystemOverviewPage />} />
                <Route path="incidents" element={<IncidentQueuePage basePath="/admin" />} />
                <Route path="incidents/:id" element={<IncidentReviewPage basePath="/admin" />} />
                <Route path="map" element={<MapViewPage basePath="/admin" />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="responders" element={<RespondersPage />} />
                <Route path="incident-types" element={<IncidentTypesPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
