import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Load authData flat from localStorage
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("authData");
    return stored ? JSON.parse(stored) : null;
  });

  // Keep localStorage in sync (optional extra safety)
  useEffect(() => {
    if (user) {
      localStorage.setItem("authData", JSON.stringify(user));
    } else {
      localStorage.removeItem("authData");
    }
  }, [user]);

  // Extract token and userId from user object
  // Derive helpers
  const token = user?.token || null;
  const userId = user?.userId || null;
  const roleId = user?.roleId || null;
  const orgId = user?.orgId || null;
  const permissions = user?.permissions || [];
  const phone = user?.phone || null;

  const logout = () => {
    setUser(null);
    localStorage.removeItem("authData");
    sessionStorage.removeItem("loginConfirmationResult");
    sessionStorage.removeItem("loginRoleId");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        userId,
        roleId,
        orgId,
        permissions,
        phone,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}