import React from "react";
import { FaDiscord, FaGithub, FaLinkedin } from "react-icons/fa";
import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-icons">
          <a href="https://discord.com/invite/code4govtech-973851473131761674" target="_blank" rel="noopener noreferrer">
            <FaDiscord />
          </a>
          <a href="https://github.com/Code4GovTech" target="_blank" rel="noopener noreferrer">
            <FaGithub />
          </a>
          <a href="https://www.linkedin.com/company/code-for-govtech/" target="_blank" rel="noopener noreferrer">
            <FaLinkedin />
          </a>
        </div>

        <p className="copyright">
          © {new Date().getFullYear()} Code for GovTech. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
