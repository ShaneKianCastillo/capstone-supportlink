// src/components/custodian/AddUser.jsx
import React, { useEffect, useState } from "react";
import { Eye, EyeClosed, X } from "lucide-react";
import { auth, db } from "../../config/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { passNotMatched, accountCreated } from "../../js/login.js";
import Swal from "sweetalert2";

const UNIQUE_ROLES = [
  "IT Support Specialist",
  "CSD Admin",
  "Property Custodian",
];

const AddUser = ({ open, setOpen }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // new User states
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // loading overlay
  const [saving, setSaving] = useState(false);

  const resetAll = () => {
    setEmail("");
    setName("");
    setRole("");
    setDepartment("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // Reset on open so fields/toggles don't persist between sessions
  useEffect(() => {
    if (open) resetAll();
  }, [open]);

  const handleClose = () => {
    if (saving) return;
    resetAll();
    setOpen(false);
  };

  const togglePasswordVisibility = () => setShowPassword((v) => !v);
  const toggleConfirmPasswordVisibility = () =>
    setShowConfirmPassword((v) => !v);

  if (!open) return null;

  const signIn = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      passNotMatched();
      return;
    }

    try {
      setSaving(true);

      // 🔎 Uniqueness check BEFORE creating the Auth user
      if (UNIQUE_ROLES.includes(role)) {
        const q = query(
          collection(db, "users"),
          where("role", "==", role),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          await Swal.fire({
            icon: "error",
            title: "Role already assigned",
            text:
              `There is already a user with the role "${role}". ` +
              `Only one account is allowed for this role. ` +
              `MIS Admins can be duplicated for handover, but not ${role}.`,
            confirmButtonColor: "#111827",
          });
          setSaving(false);
          return;
        }
      }

      // 1️⃣ Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const user = userCredential.user;

      // 2️⃣ Store user info in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email.trim(),
        name: name.trim(),
        role,
        department: department.trim(),
        createdAt: serverTimestamp(),
        disabled: false,
      });

      accountCreated();

      // ✅ Close and clear everything
      handleClose();
    } catch (error) {
      console.error("Error signing up:", error);
      await Swal.fire({
        icon: "error",
        title: "Unable to create account",
        text: error?.message || "Please try again.",
        confirmButtonColor: "#111827",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pt-10">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-black opacity-50"
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-lg w-full max-w-md p-6 transform transition-all duration-300 -translate-y-10 animate-slide-in"
        style={{ animation: "slideIn 0.3s ease-out forwards" }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          aria-label="Close"
          disabled={saving}
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-4">Add New User</h2>

        <form className="flex flex-col gap-3" onSubmit={signIn}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            className="border-black border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
            disabled={saving}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            placeholder="Name"
            className="border-black border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
            disabled={saving}
          />

          {/* Role (Dropdown) */}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border-black border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            required
            disabled={saving}
          >
            <option value="" disabled>
              Select a role
            </option>
            <option value="User">User</option>
            <option value="MIS Admin">MIS Admin</option>
            <option value="CSD Admin">CSD Admin</option>
            <option value="MIS Asst. Admin">MIS Asst. Admin</option>
            <option value="CSD Asst. Admin">CSD Asst. Admin</option>
            <option value="Property Custodian">Property Custodian</option>
            <option value="IT Support Specialist">IT Support Specialist</option>
          </select>

          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            type="text"
            placeholder="Department"
            className="border-black border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
            disabled={saving}
          />

          {/* Password */}
          <div className="flex items-center border-black border p-2 rounded-lg focus-within:ring-2 focus-within:ring-blue-400">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="flex-1 outline-none"
              required
              minLength={6}
              disabled={saving}
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="focus:outline-none ml-2"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={saving}
            >
              {showPassword ? <EyeClosed size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="flex items-center border-black border p-2 rounded-lg focus-within:ring-2 focus-within:ring-blue-400">
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              className="flex-1 outline-none"
              required
              minLength={6}
              disabled={saving}
            />
            <button
              type="button"
              onClick={toggleConfirmPasswordVisibility}
              className="focus:outline-none ml-2"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              disabled={saving}
            >
              {showConfirmPassword ? <EyeClosed size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg border-black border bg-[#0A1936] text-white cursor-pointer transition-colors disabled:opacity-60"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#F2B611] text-white transition-colors disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Adding User…" : "Add User"}
            </button>
          </div>
        </form>
      </div>

      {/* Slide animation */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-50px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Loading overlay (matches your ReportModule style) */}
      {saving && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[60]">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <p className="text-lg font-semibold">Creating account...</p>
            <div className="mt-3">
              <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddUser;
