import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, Ban, Trash2 } from "lucide-react";
import AddUser from "./AddUser";
import { db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import Swal from "sweetalert2";

const PAGE_SIZE = 5;

// keep pagination steady under a 5-row table
const ROW_H = 48;       // Tailwind h-12 ~= 48px
const HEADER_H = 48;    // thead height ~= 48px
const TABLE_MIN_PX = HEADER_H + ROW_H * PAGE_SIZE;

// Roles config
const ADMIN_LIKE_ROLES = [
  "Admin",
  "MIS Admin",
  "CSD Admin",
  "MIS Asst. Admin",
  "CSD Asst. Admin",
  "Property Custodian",
];
const CAN_ADD_USER_ROLES = ["Admin", "MIS Admin"];
const ASSISTANT_ROLES = ["MIS Asst. Admin", "CSD Asst. Admin"];
const CAN_DELETE_ROLES = ["MIS Admin"]; // who can remove blocked accounts from Firestore

const UserManagement = () => {
  const [open, setOpen] = useState(false);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState("");
  const [filter, setFilter] = useState("all"); // all | admin | user | blocked

  const [page, setPage] = useState(1);

  const [myRole, setMyRole] = useState(localStorage.getItem("role") || "");
  const canAddUser = CAN_ADD_USER_ROLES.includes(myRole);
  const hideActionsGlobally = ASSISTANT_ROLES.includes(myRole);

  useEffect(() => {
    const onStorage = () => setMyRole(localStorage.getItem("role") || "");
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    setLoading(true);
    const ref = collection(db, "users");
    const q = query(ref, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(rows);
        setLoading(false);
      },
      (err) => {
        console.error("[UserManagement] onSnapshot error:", err);
        setUsers([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Enable / Disable (mirror in blockedUsers)
  const toggleUserStatus = async (user) => {
    const result = await Swal.fire({
      title: user.disabled ? "Enable this account?" : "Disable this account?",
      text: user.disabled
        ? "This user will be able to sign in again."
        : "This user will not be able to sign in.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: user.disabled ? "Yes, enable" : "Yes, disable",
      cancelButtonText: "Cancel",
      confirmButtonColor: user.disabled ? "#16a34a" : "#dc2626",
    });
    if (!result.isConfirmed) return;

    const userRef = doc(db, "users", user.id);
    const blockedRef = doc(db, "blockedUsers", user.id);

    try {
      Swal.fire({
        title: user.disabled ? "Enabling..." : "Disabling...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        showConfirmButton: false,
      });

      if (user.disabled) {
        await updateDoc(userRef, { disabled: false });
        await deleteDoc(blockedRef);
        Swal.close();
        await Swal.fire({
          title: "Enabled!",
          text: `${user.name || user.email} is now enabled.`,
          icon: "success",
          timer: 1200,
          showConfirmButton: false,
        });
      } else {
        await updateDoc(userRef, { disabled: true });
        await setDoc(blockedRef, {
          ...user,
          disabled: true,
          disabledAt: new Date(),
        });
        Swal.close();
        await Swal.fire({
          title: "Disabled!",
          text: `${user.name || user.email} is now disabled.`,
          icon: "success",
          timer: 1200,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
      Swal.close();
      Swal.fire("Error!", "Could not update user status.", "error");
    }
  };

  // Remove blocked user from Firestore (NOT Auth)
  const deleteBlockedUser = async (user) => {
    const ok = await Swal.fire({
      title: "Remove this account from the directory?",
      text:
        "This will delete the user's record from Firestore (users and blockedUsers). "
        + "It will NOT delete the Firebase Auth account.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Remove",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });
    if (!ok.isConfirmed) return;

    try {
      Swal.fire({
        title: "Removing...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        showConfirmButton: false,
      });

      await Promise.all([
        deleteDoc(doc(db, "users", user.id)),
        deleteDoc(doc(db, "blockedUsers", user.id)),
      ]);

      Swal.close();
      await Swal.fire({
        title: "Removed",
        text: "The account has been removed from Firestore.",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("deleteBlockedUser:", err);
      Swal.close();
      Swal.fire("Error", "Could not remove the account from Firestore.", "error");
    }
  };

  // derived list (filter + search + hide own role group)
  const visibleUsers = useMemo(() => {
    const q = queryText.trim().toLowerCase();

    return users
      .filter((u) => {
        // hide the role group equal to myRole if I'm admin-like
        if (ADMIN_LIKE_ROLES.includes(myRole) && u.role === myRole) return false;

        const role = (u.role || "").trim();
        const isAdminLike = ADMIN_LIKE_ROLES.includes(role);
        const isBlocked = !!u.disabled;

        if (filter === "admin") return isAdminLike;
        if (filter === "user") return !isAdminLike;
        if (filter === "blocked") return isBlocked;
        return true;
      })
      .filter((u) => {
        if (!q) return true;
        const name = (u.name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const role = (u.role || "").toLowerCase();
        const dept = (u.department || "").toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          role.includes(q) ||
          dept.includes(q)
        );
      });
  }, [users, filter, queryText, myRole]);

  // reset page on query/filter change
  useEffect(() => {
    setPage(1);
  }, [filter, queryText]);

  // pagination
  const totalPages = Math.max(1, Math.ceil(visibleUsers.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const startIdx = (page - 1) * PAGE_SIZE;
  const pageUsers = visibleUsers.slice(startIdx, startIdx + PAGE_SIZE);

  const formatDate = (ts) => {
    try {
      const d =
        ts && typeof ts.toDate === "function"
          ? ts.toDate()
          : ts instanceof Date
          ? ts
          : null;
      if (!d) return "—";
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  // row-level permissions
  const canToggleRow = (u) => {
    const isAdminLike = ADMIN_LIKE_ROLES.includes(u.role || "");
    if (isAdminLike) return myRole === "MIS Admin"; // only MIS Admin toggles admins
    return !hideActionsGlobally; // assistants can't toggle anyone
  };
  const canDeleteRow = (u) => u.disabled && CAN_DELETE_ROLES.includes(myRole);

  const COLS = 6;

  return (
    <div className="p-3 h-full flex flex-col">
      {/* Header */}
      <div className="w-full flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h1 className="text-2xl sm:text-3xl font-semibold">Users</h1>

        {canAddUser && (
          <button
            onClick={() => setOpen(true)}
            className="border-2 border-black cursor-pointer rounded py-2 px-3 flex items-center gap-1 font-semibold hover:bg-gray-100 transition-colors"
          >
            <Plus size={18} /> Add User
          </button>
        )}
      </div>

      {/* Search */}
      <div className="w-full flex items-center justify-center mt-4 gap-2">
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
        placeholder="Search a user by name, email, role, or department"
          className="flex-1 border-2 border-black rounded p-2 focus:outline-none focus:border-gray-500"
        />
        <button className="p-2 border-2 border-black rounded hover:bg-gray-100 transition-colors">
          <Search />
        </button>
      </div>

      {/* Filter */}
      <div className="w-full mt-3">
        <label className="block text-sm font-semibold mb-1">Filter by</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full sm:w-60 border-2 border-black rounded p-2 bg-white"
        >
          <option value="all">All</option>
          <option value="admin">Role: Admin</option>
          <option value="user">Role: User</option>
          <option value="blocked">Blocked users</option>
        </select>
      </div>

      {/* Table + anchored pagination */}
      {loading ? (
        <div className="mt-6 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="font-semibold">Loading users...</p>
            <div className="mt-3 animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        </div>
      ) : (
        <>
          {/* This shell reserves the vertical space of a 5-row table so the pager stays put */}
          <div className="mt-6 overflow-x-auto" style={{ minHeight: `${TABLE_MIN_PX}px` }}>
            <table className="min-w-full border-collapse">
              <thead className="bg-[#494949]">
                <tr>
                  <th className="h-12 border-white text-white border-2 p-2 text-center">Email</th>
                  <th className="h-12 border-white text-white border-2 p-2 text-center">Name</th>
                  <th className="h-12 border-white text-white border-2 p-2 text-center">Role</th>
                  <th className="h-12 border-white text-white border-2 p-2 text-center">Department</th>
                  <th className="h-12 border-white text-white border-2 p-2 text-center">Date Created</th>
                  <th className="h-12 border-white border-2 p-2 text-white text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageUsers.length === 0 ? (
                  <tr>
                    <td
                      className="h-12 border-white border-2 p-4 text-center text-gray-500"
                      colSpan={COLS}
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  pageUsers.map((u) => {
                    const showToggle = canToggleRow(u);
                    const showDelete = canDeleteRow(u);

                    return (
                      <tr key={u.id} className="odd:bg-[#FFE7F6] even:bg-[#C8C8C8]">
                        <td className="h-12 border-white border-2 p-2 text-center">{u.email || "—"}</td>
                        <td className="h-12 border-white border-2 p-2 text-center">{u.name || "—"}</td>
                        <td className="h-12 border-white border-2 p-2 text-center">{u.role || "—"}</td>
                        <td className="h-12 border-white border-2 p-2 text-center">
                          {(u.department || "").toUpperCase() || "—"}
                        </td>
                        <td className="h-12 border-white border-2 p-2 text-center">
                          {formatDate(u.createdAt)}
                        </td>
                        <td className="h-12 border-white border-2 p-2 text-center">
                          <div className="flex justify-center items-center gap-2 flex-wrap">
                            {showToggle && (
                              <button
                                onClick={() => toggleUserStatus(u)}
                                className={`${
                                  u.disabled
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-red-500 hover:bg-red-600"
                                } flex justify-center items-center px-3 font-semibold text-white rounded gap-2 py-2 cursor-pointer transition-colors`}
                              >
                                <Ban />
                                {u.disabled ? "Enable" : "Disable"}
                              </button>
                            )}
                            {showDelete && (
                              <button
                                onClick={() => deleteBlockedUser(u)}
                                className="bg-gray-800 hover:bg-black text-white font-semibold px-3 py-2 rounded flex items-center gap-2"
                                title="Remove from Firestore"
                              >
                                <Trash2 />
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination anchored just under the table shell */}
          {visibleUsers.length > 0 && (
            <div className="mt-4 pb-4 flex flex-wrap justify-center items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`px-3 py-1 border rounded transition-colors ${
                  page === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200"
                }`}
              >
                Previous
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1 border rounded transition-colors ${
                      p === page ? "bg-blue-500 text-white" : "hover:bg-gray-200"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`px-3 py-1 border rounded transition-colors ${
                  page === totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200"
                }`}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      <AddUser open={open} setOpen={setOpen} />
    </div>
  );
};

export default UserManagement;
