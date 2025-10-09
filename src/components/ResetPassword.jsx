// src/components/auth/ResetPassword.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "../config/firebase";
import { Eye, EyeClosed } from "lucide-react";
import Swal from "sweetalert2";
import capstoneLogo from "../assets/capstoneLogo_nn.png";
import loginBg from "../assets/loginPanel.png";

/* ----------------- Hoisted UI bits so they don't remount ----------------- */

const LeftHero = () => (
  <div className="relative order-1 md:order-2 flex items-start justify-center bg-gray-200">
    <img
      src={loginBg}
      alt="Campus"
      className="absolute inset-0 h-full w-full object-contain object-cover"
    />
    <div className="absolute inset-0 bg-gradient-to-tr from-black/10 via-black/15 to-transparent" />
    <div className="relative z-10 w-full max-w-sm px-6 md:px-10 pt-10 md:pt-14 pb-8">
      <div className="inline-block rounded-xl bg-black/30 backdrop-blur-md px-4 py-3">
        <h3 className="text-white text-2xl md:text-3xl font-extrabold drop-shadow-[0_3px_8px_rgba(0,0,0,0.8)]">
          Set a new password
        </h3>
        <p className="mt-1 text-white/90 text-sm md:text-base drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
          Keep your account secure with a strong passphrase.
        </p>
      </div>
    </div>
  </div>
);

const RightVerifying = () => (
  <div className="order-1 md:order-2 p-8 md:p-10">
    <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4">
      Verifying link…
    </h2>
    <div className="h-11 w-full rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-500 border-t-transparent mr-2" />
      Please wait
    </div>
    <div className="mx-auto mt-5 h-0.5 w-2/3 bg-black/80" />
    <div className="mt-3 text-center">
      <Link to="/login" className="text-sm font-medium text-gray-800 underline">
        Back to Login
      </Link>
    </div>
  </div>
);

const RightInvalid = () => (
  <div className="order-1 md:order-2 p-8 md:p-10">
    <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4">
      Invalid or Used Link
    </h2>
    <p className="text-sm text-gray-700 mb-4">
      This password reset link is invalid, expired, or already used.
    </p>
    <Link
      to="/forgot-password"
      className="inline-block px-5 py-2 rounded-xl bg-gray-900 text-white hover:bg-black"
    >
      Request a new link
    </Link>

    <div className="mx-auto mt-5 h-0.5 w-2/3 bg-black/80" />
    <div className="mt-3 text-center">
      <Link to="/login" className="text-sm font-medium text-gray-800 underline">
        Back to Login
      </Link>
    </div>
  </div>
);

function RightForm({
  email,
  pw,
  setPw,
  pw2,
  setPw2,
  showA,
  setShowA,
  showB,
  setShowB,
  submitting,
  onSubmit,
}) {
  return (
    <div className="order-1 md:order-2 p-8 md:p-10">
      <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4">
        Reset Password
      </h2>

      {/* Pink Logo centered */}
      <div className="mb-4 flex justify-center">
        <img
          src={capstoneLogo}
          alt="Capstone Logo"
          className="block object-contain h-24 w-24 md:h-28 md:w-28"
        />
      </div>

      {email && (
        <p className="text-sm text-gray-600 mb-4">
          For: <span className="font-medium">{email}</span>
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        {/* New password */}
        <label className="block text-sm font-medium text-gray-700 mb-1">
          New Password
        </label>
        <div className="flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm">
          <input
            type={showA ? "text" : "password"}
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
            placeholder="Enter new password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowA((v) => !v)}
            className="ml-2 inline-flex items-center justify-center text-gray-700"
          >
            {showA ? <EyeClosed className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Confirm password */}
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Confirm Password
        </label>
        <div className="flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm">
          <input
            type={showB ? "text" : "password"}
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
            placeholder="Re-enter new password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowB((v) => !v)}
            className="ml-2 inline-flex items-center justify-center text-gray-700"
          >
            {showB ? <EyeClosed className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className={`mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-gray-900 text-white font-semibold tracking-wide transition hover:bg-black ${
            submitting ? "cursor-not-allowed opacity-70" : "cursor-pointer"
          }`}
        >
          {submitting ? "Saving..." : "Update Password"}
        </button>

        <div className="mx-auto mt-5 h-0.5 w-2/3 bg-black/80" />

        <div className="mt-3 text-center">
          <Link to="/login" className="text-sm font-medium text-gray-800 underline">
            Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------- Main ----------------------------------- */

const ResetPassword = () => {
  const nav = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");

  const [verifying, setVerifying] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showA, setShowA] = useState(false);
  const [showB, setShowB] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (mode !== "resetPassword" || !oobCode) {
        setVerifying(false);
        setValid(false);
        Swal.fire({
          icon: "error",
          title: "Invalid link",
          text: "This password reset link is invalid or incomplete.",
          confirmButtonColor: "#111827",
        });
        return;
      }
      try {
        const mail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(mail || "");
        setValid(true);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("verifyPasswordResetCode:", e);
        setValid(false);
        Swal.fire({
          icon: "error",
          title: "Link expired or used",
          text: "This password reset link is invalid, expired, or already used. Request a new one.",
          confirmButtonColor: "#111827",
        });
      } finally {
        setVerifying(false);
      }
    };
    run();
  }, [mode, oobCode]);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (pw.length < 6) {
      Swal.fire({
        icon: "error",
        title: "Weak password",
        text: "Password must be at least 6 characters.",
        confirmButtonColor: "#111827",
      });
      return;
    }
    if (pw !== pw2) {
      Swal.fire({
        icon: "error",
        title: "Passwords don’t match",
        text: "Please make sure both passwords are the same.",
        confirmButtonColor: "#111827",
      });
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, pw);
      await Swal.fire({
        icon: "success",
        title: "Password updated",
        text: "Your password has been reset successfully.",
        confirmButtonColor: "#111827",
      });
      nav("/login", { replace: true, state: { resetSuccess: true } });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("confirmPasswordReset:", e);
      Swal.fire({
        icon: "error",
        title: "Link error",
        text: "This reset link is invalid or expired. Please request a new one.",
        confirmButtonColor: "#111827",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[whitesmoke] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden bg-white grid grid-cols-1 md:grid-cols-2">
        <LeftHero />
        {verifying ? (
          <RightVerifying />
        ) : valid ? (
          <RightForm
            email={email}
            pw={pw}
            setPw={setPw}
            pw2={pw2}
            setPw2={setPw2}
            showA={showA}
            setShowA={setShowA}
            showB={showB}
            setShowB={setShowB}
            submitting={submitting}
            onSubmit={onSubmit}
          />
        ) : (
          <RightInvalid />
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
