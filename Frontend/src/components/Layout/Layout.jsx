import React from "react";
import "./Layout.css";
import { Outlet } from "react-router-dom";
import Footer from "../Footer/Footer";
import Navbar from "../Navbar/Navbar";

function Layout() {
  return (
    <div className="app-layout">
      <Navbar />
      
      {/* Page Content will render here */}
      <main className="page-content">
        <Outlet />
      </main>
      
      <Footer />
    </div>
  );
}

export default Layout;
