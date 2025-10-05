// src/components/auth/ForgotPassword.jsx
import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../config/firebase";
import { X } from "lucide-react";
import { Link } from "react-router-dom";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    // This ensures the reset link opens your React route
    const actionCodeSettings = {
      url: `${window.location.origin}/reset-password`,
      handleCodeInApp: true,
    };

    try {
      await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
      setDone(true);
    } catch (err) {
      // Don’t reveal whether the email exists; just show a generic message.
      // Optionally log err.code for debugging.
      console.error("sendPasswordResetEmail:", err);
      setDone(true);
      // If you really want to surface form errors, you can map err.code here.
      // setError("Please check the email address and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[whitesmoke] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border-2 border-[#1C1D21] shadow p-6 relative">
        <h1 className="text-2xl font-semibold mb-2">Forgot Password</h1>
        <p className="text-sm text-gray-600 mb-4">
          Enter the email associated with your account and we’ll send you a password reset link.
        </p>

        {done ? (
          <div className="text-sm">
            <p className="mb-3">
              If an account exists for <span className="font-semibold">{email}</span>, a password reset email has been sent.
              Please check your inbox (and spam folder).
            </p>
            <Link
              to="/login"
              className="inline-block px-4 py-2 rounded bg-[#0A1936] text-white"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-black rounded px-3 py-2 text-sm"
            />
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="flex items-center justify-between pt-2">
              <Link to="/login" className="text-sm underline text-[#494949]">
                Back to Login
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded bg-[#F2B611] text-white disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send reset link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
