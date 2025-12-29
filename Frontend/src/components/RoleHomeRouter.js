import React from "react";
import { useAuth } from "../context/AuthContext";
import OrgManagerHome from "../pages/Home/OrgMangerHome";
import Home from "../pages/Home/Home";
import MentorHome from "../pages/Home/MentorHome";
import Admin from "../pages/Home/Admin";

export default function RoleHomeRouter() {
  const { user } = useAuth();
  const role = user?.roleId;

  if (role === "R002" || role === "R003") return <OrgManagerHome />;
  if (role === "R004") return <Home />;
  if (role === "R005") return <MentorHome />;
  if (role === "R001") return <Admin />;
  return <div>Access denied</div>;
}
