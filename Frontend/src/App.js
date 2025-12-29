import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import PageNotFound from "./pages/PageNotFound";
import SignIn from "./pages/Signin";
import ProjectDashboard from "./pages/Dashboard/ProjectDashboard";
import MembersDashboard from "./pages/Dashboard/MembersDashboard";
import OrganisationDashboard from "./pages/Dashboard/OrganisationDashboard";
import Organisation from "./pages/Organisation/Organisation";
import Member from "./pages/Member/Member";
import Project from "./pages/Project/Project";
import DashboardTabs from "./pages/Tabs/DashboardTabs";
import UserSettings from "./pages/UserSettings/UserSettings";
import RoleHomeRouter from "./components/RoleHomeRouter"; // See update below
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import theme from "./Theme";
import { ThemeProvider } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import Repository from "./pages/Repository/Repository";
import RepoDashboard from "./pages/Dashboard/RepoDashboard";
import SigninPageMui from "./pages/Signin-otp/SignInPageMui";
import OtpVerification from "./pages/Signin-otp/OtpVerification";
import LoginOtpVerification from "./pages/Signin-otp/LoginOtpVerification";
import SignUpPage from "./pages/Signin-otp/SignUpPage";
import DiscordCallback from "./pages/Signin-otp/DiscordCallback";
import Ngo from "./pages/Ngo/Ngo";
import ScrollToTop from "./components/ScrollToTop";
import TermsAndConditions from "./pages/Signin-otp/TermsAndConditions";
import UpdateForm from "./pages/Signin-otp/UpdateForm";
function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          {/* -------- STANDALONE ROUTES (No Layout/Header) ---------- */}
          <Route path='/update-form' element={<UpdateForm />} />
          <Route path="/discord-callback" element={<DiscordCallback />} />
          
          <Route element={<Layout />}>
            {/* -------- PUBLIC ROUTES ---------- */}
              <Route path="/signin" element={<SigninPageMui />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/login-otp-verify" element={<LoginOtpVerification />} />
            <Route path="/verify-otp" element={<OtpVerification />} />
            <Route path="/projects" element={<ProjectDashboard />} />
            <Route path="/project/:programName/:projectName" element={<Project />} />
            <Route path="/repositories" element={<RepoDashboard />} />
            <Route path="/repository/:repoId" element={<Repository />} />
            <Route path="/members" element={<MembersDashboard />} />
            <Route path="/member/:userId" element={<Member />} />
            <Route path="/organisations" element={<OrganisationDashboard />} />
            <Route path="/organisation/:orgId" element={<Organisation />} />
            <Route path ='/ngo' element={<Ngo/>}/>
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
            {/* <Route path="/organisation/:programName/:organisationName" element={<Organisation />} /> */}

            {/* ---------- PROTECTED ROUTES ---------- */}
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <RoleHomeRouter />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <UserSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboards"
              element={
                <ProtectedRoute>
                  <DashboardTabs />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/ngo" replace />} />
            <Route path="*" element={<PageNotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
export default App;
