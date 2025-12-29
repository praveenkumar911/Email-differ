import React, { useEffect, useState } from "react";
import "./Navbar.css";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import logo1 from "../../assets/badal_logo.png";
import logo2 from "../../assets/c4gt_logo.jpeg";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import PersonIcon from "@mui/icons-material/Person";
import { useAuth } from "../../context/AuthContext";

function Navbar() {
  const { user } = useAuth();

  const navigate = useNavigate();

  const isUserSignedIn = !!user;

  const profileValue = user?.userId ?? null;
  const profilePhoto = user?.profilePhoto ?? null;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isDashOpen, setIsDashOpen] = useState(false);

  const location = useLocation();
  const isDashboardActive = location.pathname.startsWith("/dashboards");

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
    setIsDocsOpen(false);
    setIsDashOpen(false);
  };

  const handleDocClick = (e) => {
    if (window.innerWidth <= 768) {
      e.preventDefault();
      setIsDocsOpen((prev) => !prev);
    }
  };

  const handleDashClick = (e) => {
    if (window.innerWidth <= 768) {
      e.preventDefault();
      setIsDashOpen((prev) => !prev);
    }
  };

  const handleDocsEnter = () => {
    if (window.innerWidth > 768) setIsDocsOpen(true);
  };
  const handleDocsLeave = () => {
    if (window.innerWidth > 768) setIsDocsOpen(false);
  };

  const handleDashEnter = () => {
    if (window.innerWidth > 768) setIsDashOpen(true);
  };
  const handleDashLeave = () => {
    if (window.innerWidth > 768) setIsDashOpen(false);
  };

  const handleLinkClick = () => {
    setIsMenuOpen(false);
    setIsDocsOpen(false);
    setIsDashOpen(false);
  };

  // Handle profile click - redirect to settings
  const handleProfileClick = (e) => {
    e.preventDefault();
    if (isUserSignedIn) {
      navigate("/settings");
      handleLinkClick(); // Close mobile menu if open
    }
  };

  // Determine which icon to show
  const getProfileIcon = () => {
    if (!isUserSignedIn) {
      return <PersonIcon className="profile-icon" />;
    }

    if (profilePhoto) {
      return (
        <img
          src={profilePhoto}
          alt="Profile"
          className="profile-icon"
          onClick={handleProfileClick}
          style={{ cursor: "pointer" }}
        />
      );
    }

    return (
      <PersonIcon
        className="profile-icon"
        onClick={handleProfileClick}
        style={{ cursor: "pointer" }}
      />
    );
  };

  const projectPaths = [
    "/projects",
    "/project",
    "/repository",
    "/repositories",
  ];
  const isProjectActive = projectPaths.some((p) =>
    location.pathname.startsWith(p)
  );

  return (
    <nav className="navbar">
      {/* Left Section: Two Logos */}
      <div className="navbar-left">
        <img src={logo1} alt="Logo 1" className="logo" />
        <img src={logo2} alt="Logo 2" className="logo" />
      </div>

      {/* Middle Section: Navigation Links */}
      <div className={`navbar-center ${isMenuOpen ? "open" : ""}`}>
        <NavLink
          to="/ngo"
          className={({ isActive }) =>
            isActive ? "nav-item active" : "nav-item"
          }
          onClick={handleLinkClick}
        >
          NGO
        </NavLink>

        {/* Show Home and Dashboards if user is signed in */}
        {isUserSignedIn && (
          <NavLink
            className={({ isActive }) =>
              isActive ? "nav-item active" : "nav-item"
            }
            to="/home"
            onClick={handleLinkClick}
          >
            Home
          </NavLink>
        )}

        <NavLink
          // created the array 'projectPaths' to include multiple paths for Projects
          className={() => (isProjectActive ? "nav-item active" : "nav-item")}
          to="/projects"
          onClick={handleLinkClick}
        >
          Projects
        </NavLink>

        {/* <NavLink
          to="/members"
          className={() =>
            location.pathname.startsWith("/member")
              ? "nav-item active"
              : "nav-item"
          }
          onClick={handleLinkClick}
        >
          Members
        </NavLink> */}

        <NavLink
          to="/organisations"
          className={() =>
            location.pathname.startsWith("/organisation")
              ? "nav-item active"
              : "nav-item"
          }
          onClick={handleLinkClick}
        >
          Organisations
        </NavLink>

        {/* Dashboards only for signed-in users */}
        {isUserSignedIn && (
          <div
            className="nav-dropdown"
            onMouseEnter={handleDashEnter}
            onMouseLeave={handleDashLeave}
          >
            <a
              href="#"
              className={`nav-dropdown-link ${
                isDashboardActive ? "active" : ""
              }`}
              onClick={(e) => {
                e.preventDefault();
                handleDashClick(e);
              }}
              aria-haspopup="true"
              aria-expanded={isDashOpen}
            >
              Dashboards
              <KeyboardArrowDownIcon className="dropdown-arrow" />
            </a>
            <div className={`nav-submenu ${isDashOpen ? "open" : ""}`}>
              <div className="submenu-section">
                <Link to="/dashboards?tab=tab1" onClick={handleLinkClick}>
                  Community Dashboard - May 2025
                </Link>
                <Link to="/dashboards?tab=tab2" onClick={handleLinkClick}>
                  C4GT Community Dashboard
                </Link>
                <Link to="/dashboards?tab=tab3" onClick={handleLinkClick}>
                  Augtoberfest Leaderboard
                </Link>
              </div>
            </div>
          </div>
        )}

        <div
          className="nav-dropdown"
          onMouseEnter={handleDocsEnter}
          onMouseLeave={handleDocsLeave}
        >
          <a
            href="#"
            className="nav-dropdown-link"
            onClick={(e) => {
              e.preventDefault();
              handleDocClick(e);
            }}
            aria-haspopup="true"
            aria-expanded={isDocsOpen}
          >
            Documentation
            <KeyboardArrowDownIcon className="dropdown-arrow" />
          </a>
          <div className={`nav-submenu ${isDocsOpen ? "open" : ""}`}>
            {/* Community Program */}
            <div className="submenu-section">
              <span className="submenu-title">Community Program</span>
              <a
                href="https://github.com/Code4GovTech/C4GT/wiki/How-to-participate-as-an-organisation"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLinkClick}
              >
                To participate as an Org in Community Program
              </a>
            </div>
            {/* DMP */}
            <div className="submenu-section">
              <span className="submenu-title">DMP</span>
              <a
                href="https://github.com/Code4GovTech/C4GT/wiki/How-to-participate-as-an-organization-in-the-Dedicated-Mentoring-Program-%20%0A%20(DMP)-2024"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLinkClick}
              >
                Organizations & Mentors for DMP - Roles & Respons..
              </a>
              <a
                href="https://github.com/Code4GovTech/C4GT/wiki/Evaluation-Criteria"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLinkClick}
              >
                Project Evaluation Parameters
              </a>
              <a
                href="https://github.com/Code4GovTech/C4GT23/wiki/Sample-Proposal"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLinkClick}
              >
                Contributors for DMP
              </a>
            </div>
            {/* Open Community Projects */}
            <div className="submenu-section">
              <span className="submenu-title">Open Community Projects</span>
              <a
                href="https://github.com/Code4GovTech/C4GT/wiki/How-to-participate-as-an-organisation"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLinkClick}
              >
                How to participate as an Organisation
              </a>
              <a
                href="https://github.com/Code4GovTech/C4GT/wiki/Types-of-projects-&-examples"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLinkClick}
              >
                Types of Projects & Examples
              </a>
              <a
                href="https://github.com/Code4GovTech/C4GT/wiki/Guidelines-Ticket-Creation"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLinkClick}
              >
                Guidelines for Project Listing
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section: Profile or Sign In */}
      <div className="navbar-right">
        {isUserSignedIn ? (
          <div
            className="profile-section"
            onClick={handleProfileClick}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            {getProfileIcon()}
            <span className="profile-name">{profileValue}</span>
          </div>
        ) : (
          <>
            <Link
              to="/signin"
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <PersonIcon className="profile-icon" />
              <span className="profile-name signin-btn">Sign In</span>
            </Link>
          </>
        )}
      </div>
      {/* Hamburger Button */}
      <div
        className={`hamburger ${isMenuOpen ? "open" : ""}`}
        onClick={toggleMenu}
      >
        <span></span>
        <span></span>
        <span></span>
      </div>
    </nav>
  );
}

export default Navbar;
