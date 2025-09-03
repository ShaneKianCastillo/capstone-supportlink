import React, { useState } from "react";
import { Eye, EyeClosed, X } from "lucide-react";
import { auth, db } from "../../config/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import {passNotMatched, accountCreated} from '../../js/login.js';

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
  

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

  if (!open) return null;

  const signIn = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      passNotMatched();
      return;
    }

    try {
      // 1️⃣ Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      // 2️⃣ Store user info in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email,
        name: name,
        role: role,
        department: department,
        createdAt: serverTimestamp(),
      });

      accountCreated();
      setOpen(false);
    } catch (error) {
      console.error("Error signing up:", error);
      alert(error.message);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pt-10">
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black opacity-50"
      ></div>

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-lg w-full max-w-md p-6 transform transition-all duration-300 -translate-y-10 animate-slide-in"
        style={{ animation: "slideIn 0.3s ease-out forwards" }}
      >
        {/* Close button */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-4">Add New User</h2>
        <form className="flex flex-col gap-3" onSubmit={signIn}>
          <input
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            className="border-black border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          <input
            onChange={(e) => setName(e.target.value)}
            type="text"
            placeholder="Name"
            className="border-black border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          {/* Role (Dropdown) */}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border-black border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          >
            <option value="" disabled>Select a role</option>
            <option value="User">User</option>
            <option value="MIS Admin">MIS Admin</option>
            <option value="CSD Admin">CSD Admin</option>
            <option value="MIS Asst. Admin">MIS Asst. Admin</option>
            <option value="CSD Asst. Admin">CSD Asst. Admin</option>
            <option value="Property Custodian">Property Custodian</option>
          </select>
          <input
            onChange={(e) => setDepartment(e.target.value)}
            type="text"
            placeholder="Department"
            className="border-black border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />

          {/* Password Input */}
          <div className="flex items-center border-black border p-2 rounded-lg focus-within:ring-2 focus-within:ring-blue-400">
            <input
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="flex-1 outline-none"
              required
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="focus:outline-none ml-2"
            >
              {showPassword ? <EyeClosed size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Confirm Password Input */}
          <div className="flex items-center border-black border p-2 rounded-lg focus-within:ring-2 focus-within:ring-blue-400">
            <input
              onChange={(e) => setConfirmPassword(e.target.value)}
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              className="flex-1 outline-none"
              required
            />
            <button
              type="button"
              onClick={toggleConfirmPasswordVisibility}
              className="focus:outline-none ml-2"
            >
              {showConfirmPassword ? (
                <EyeClosed size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg border-black border bg-[#0A1936] text-white cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#F2B611] text-white transition-colors"
            >
              Add User
            </button>
          </div>
        </form>
      </div>

      {/* Slide animation */}
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-50px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default AddUser;
