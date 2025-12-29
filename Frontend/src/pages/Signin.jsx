import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Legacy passwordless Signin replaced by OTP-based SignInPageMui
// This component simply redirects to the canonical SignIn route.
const SignIn = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/signin', { replace: true });
  }, [navigate]);
  return null;
};

export default SignIn;
