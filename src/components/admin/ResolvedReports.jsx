// src/components/admin/ResolvedReports.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Search, Download as DownloadIcon, Trash2, RotateCw, MessageSquareText } from "lucide-react";
import { db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  query,
  doc,
  deleteDoc,
  getDoc,
  setDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Swal from "sweetalert2";

// ⬇️ Download modal
import Download from "./Download";

// pagination + steady layout like UserManagement
const PAGE_SIZE = 5;
const ROW_H = 48;     // Tailwind h-12 ≈ 48px
const HEADER_H = 48;  // thead height
const TABLE_MIN_PX = HEADER_H + ROW_H * PAGE_SIZE; // keeps pager in place

const ResolvedReports = () => {
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // pagination
  const [page, setPage] = useState(1);

  // filter dropdown: all | approved | declined | pending
  const [filterState, setFilterState] = useState("all");

  // modal
  const [showDownload, setShowDownload] = useState(false);

  // current role
  const [myRole, setMyRole] = useState(localStorage.getItem("role") || "");
  useEffect(() => {
    const sync = () => setMyRole(localStorage.getItem("role") || "");
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // current uid (for Download)
  const uid = getAuth().currentUser?.uid || localStorage.getItem("uid") || "";

  const isMIS =
    myRole === "MIS Admin" || myRole === "MIS Asst. Admin";

  const renderUserApprovalChip = (r) => {
    const s = (r.userApprovalStatus || "pending").toLowerCase();
    if (s === "approved") {
      return (
        <span className="text-green-600 text-xs px-2 py-1 rounded">
          Resolved (Approved by User)
        </span>
      );
    }
    if (s === "declined") {
      return (
        <span className="text-red-600 text-xs px-2 py-1 rounded">
          Not Resolved (Declined by User)
        </span>
      );
    }
    // pending
    const pendingFor = r.userApprovalPendingForName || "User";
    return (
      <span className="text-gray-900 text-xs px-2 py-1 rounded">
        Pending for {pendingFor} approval
      </span>
    );
  };

  // roles → allowed service types
  const allowedTypesForRole = (role) => {
    switch (role) {
      case "CSD Admin":
      case "CSD Asst. Admin":
        return ["Facilities and Maintenance"];
      case "MIS Admin":
      case "MIS Asst. Admin":
        return ["IT Support Services - Software"];
      case "IT Support Specialist":
        return ["IT Support Services - Hardware"];
      case "Admin":
        return [
          "Facilities and Maintenance",
          "IT Support Services - Hardware",
          "IT Support Services - Software",
        ];
      default:
        return [];
    }
  };

  const allowedTypes = allowedTypesForRole(myRole);
  const hideActions =
    myRole === "MIS Asst. Admin" || myRole === "CSD Asst. Admin";

  // subscribe to resolvedReports
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "resolvedReports")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
          const ra =
            a.resolvedAt?.toMillis?.() ?? a.serverTimeStamp?.toMillis?.() ?? 0;
          const rb =
            b.resolvedAt?.toMillis?.() ?? b.serverTimeStamp?.toMillis?.() ?? 0;
          return rb - ra;
        });
        setReports(rows);
        setLoading(false);
      },
      (err) => {
        console.error("[ResolvedReports] onSnapshot error:", err);
        setReports([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const formatDateTime = (ts) => {
    try {
      const d =
        ts && typeof ts.toDate === "function"
          ? ts.toDate()
          : ts instanceof Date
          ? ts
          : null;
      if (!d) return "—";
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  // role filter
  const roleFiltered = useMemo(() => {
    if (!allowedTypes.length) return [];
    return reports.filter((r) => allowedTypes.includes(r.serviceType || ""));
  }, [reports, allowedTypes]);

  // respect admin hide flag
  const roleAndAdminFiltered = useMemo(() => {
    return roleFiltered.filter((r) => !r.hiddenForAdmin);
  }, [roleFiltered]);

  // dropdown filter
  const byDropdown = useMemo(() => {
    if (filterState === "all") return roleAndAdminFiltered;
    return roleAndAdminFiltered.filter((r) => {
      const s = (r.userApprovalStatus || "pending").toLowerCase();
      return s === filterState;
    });
  }, [roleAndAdminFiltered, filterState]);

  // search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return byDropdown;
    const q = search.toLowerCase();
    return byDropdown.filter((r) => {
      if (isMIS) {
        // MIS: search platform + details
        return (
          (r.platformName || r.systemName || r.platform || "")
            .toLowerCase()
            .includes(q) ||
          (r.additionalDetails || "").toLowerCase().includes(q)
        );
      }
      // Others: building/floor/details
      return (
        (r.buildingName || "").toLowerCase().includes(q) ||
        (r.floorLocation || "").toLowerCase().includes(q) ||
        (r.additionalDetails || "").toLowerCase().includes(q)
      );
    });
  }, [search, byDropdown, isMIS]);

  // reset page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [search, filterState, myRole]);

  // pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const startIdx = (page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  // ---------- Remove (soft-hide / hard-delete if both sides removed) ----------
  const handleDelete = async (report) => {
    try {
      const result = await Swal.fire({
        title: "Remove this report?",
        text: "This action will remove the report from the Resolved Report List.",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Continue",
      });
      if (!result.isConfirmed) return;

      Swal.fire({
        title: "Applying...",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      const ownerUid = report.uid;
      const hideDocId = `${ownerUid}_${report.id}`;
      const hideDocRef = doc(db, "userResolvedHides", hideDocId);
      const hideSnap = await getDoc(hideDocRef);

      if (hideSnap.exists()) {
        await deleteDoc(doc(db, "resolvedReports", report.id));
        Swal.close();
        await Swal.fire({
          title: "Deleted",
          text: "The report is deleted successfully",
          icon: "success",
          timer: 1400,
          showConfirmButton: false,
        });
      } else {
        await setDoc(
          doc(db, "resolvedReports", report.id),
          {
            hiddenForAdmin: true,
            hiddenForAdminAt: serverTimestamp(),
          },
          { merge: true }
        );
        Swal.close();
        await Swal.fire({
          title: "Removed Report",
          text: "This report is successfully removed from the Resolved Report List",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      console.error("[ResolvedReports] delete/hide error:", err);
      Swal.close();
      Swal.fire("Error", "Failed to remove the report.", "error");
    }
  };

  // ---------- Re-process a declined resolution ----------
  const handleReprocess = async (report) => {
    try {
      const ok = await Swal.fire({
        title: "Make this report On Process again?",
        text: "The report was declined by the user. This will move it back to On Process.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Process",
      });
      if (!ok.isConfirmed) return;

      Swal.fire({
        title: "Moving...",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      const batch = writeBatch(db);

      const fromRef = doc(db, "resolvedReports", report.id);
      const toRef = doc(db, "onProcess", report.id);

      // strip resolution/approval fields before moving
      const {
        id, // eslint-disable-line
        resolvedAt,
        resolvedByUid,
        resolvedByName,
        resolvedByDept,
        resolvedImageUrl,
        resolutionNotes,
        userApprovalStatus,
        userApprovalAt,
        userApprovalByUid,
        userApprovalNotes,
        userApprovalPendingForUid,
        userApprovalPendingForName,
        hiddenForAdmin,
        hiddenForAdminAt,
        ...rest
      } = report;

      batch.set(
        toRef,
        {
          ...rest,
          status: "On Process",
          processedAt: serverTimestamp(),

          // clear any resolution/approval artifacts
          resolvedAt: null,
          resolvedByUid: null,
          resolvedByName: null,
          resolvedByDept: null,
          resolvedImageUrl: null,
          resolutionNotes: null,

          userApprovalStatus: null,
          userApprovalAt: null,
          userApprovalByUid: null,
          userApprovalNotes: null,
          userApprovalPendingForUid: null,
          userApprovalPendingForName: null,
        },
        { merge: true }
      );

      batch.delete(fromRef);

      await batch.commit();

      Swal.close();
      await Swal.fire({
        title: "Moved",
        text: "The report is now On Process again.",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error("[ResolvedReports] handleReprocess error:", e);
      Swal.close();
      Swal.fire("Error", "Failed to move the report back to On Process.", "error");
    }
  };

  // ---------- View decline message (userApprovalNotes) ----------
  const handleViewMessage = async (report) => {
    const msg = (report.userApprovalNotes || "").trim();
    await Swal.fire({
      title: "User Message",
      html:
        msg
          ? `<div style="text-align:left;white-space:pre-wrap">${msg.replace(/</g, "&lt;")}</div>`
          : "<em>No message provided.</em>",
      icon: "info",
      confirmButtonText: "Close",
    });
  };

  // columns (MIS vs others)
  const COLS = hideActions ? (isMIS ? 4 : 5) : (isMIS ? 5 : 6);

  return (
    <div>
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold">Resolved Reports</h1>

        {/* Search */}
        <div className="w-full flex items-center justify-center mt-4 gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isMIS
                ? "Search by Platform/System Name or Description"
                : "Search by Building, Floor Location, or Description"
            }
            className="flex-1 border-2 border-black rounded p-2 focus:outline-none focus:border-gray-500"
          />
          <button
            onClick={() => setSearch((s) => s)}
            className="p-2 border-2 border-black rounded hover:bg-gray-100 transition-colors"
            aria-label="Search"
          >
            <Search />
          </button>
        </div>
      </div>

      {/* Filter + Download */}
      <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold whitespace-nowrap">Filter by</label>
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="w-full md:w-60 border-2 border-black rounded p-2 bg-white"
          >
            <option value="all">All</option>
            <option value="approved">Approved by User</option>
            <option value="declined">Declined by User</option>
            <option value="pending">Pending User Approval</option>
          </select>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setShowDownload(true)}
            className="flex justify-center items-center rounded border-2 border-black px-3 py-2 font-semibold gap-2 w-full md:w-auto"
            title="Download printable PDF"
          >
            Download <DownloadIcon />
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <p className="text-lg font-semibold">Loading Resolved Reports...</p>
            <div className="mt-3">
              <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mt-6 overflow-x-auto" style={{ minHeight: `${TABLE_MIN_PX}px` }}>
        <table className="min-w-full border-collapse">
          <thead className="bg-[#494949]">
            <tr>
              {isMIS ? (
                <>
                  <th className="h-12 border-white border-2 p-2 text-white text-center">
                    Platform / System Name
                  </th>
                  <th className="h-12 border-white border-2 p-2 text-white text-center">
                    Description
                  </th>
                </>
              ) : (
                <>
                  <th className="h-12 border-white border-2 p-2 text-white text-center">
                    Building
                  </th>
                  <th className="h-12 border-white border-2 p-2 text-white text-center">
                    Floor Location
                  </th>
                  <th className="h-12 border-white border-2 p-2 text-white text-center">
                    Description
                  </th>
                </>
              )}
              <th className="h-12 border-white border-2 p-2 text-white text-center">Status</th>
              <th className="h-12 border-white border-2 p-2 text-white text-center">Date Resolved</th>
              {!hideActions && (
                <th className="h-12 border-white border-2 p-2 text-white text-center">Action</th>
              )}
            </tr>
          </thead>

          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLS}
                  className="h-12 border-white border-2 p-4 text-center text-gray-500"
                >
                  {allowedTypes.length === 0
                    ? "No reports available for your role."
                    : search || filterState !== "all"
                    ? "No matching reports."
                    : "No resolved reports yet."}
                </td>
              </tr>
            ) : (
              pageRows.map((r) => {
                const isDeclined = (r.userApprovalStatus || "pending").toLowerCase() === "declined";
                const hasMsg = !!(r.userApprovalNotes || "").trim();

                return (
                  <tr key={r.id} className="odd:bg-[#FFE7F6] even:bg-[#C8C8C8]">
                    {isMIS ? (
                      <>
                        <td className="h-12 border-white border-2 p-2 text-center">
                          {r.platformName || r.systemName || r.platform || "—"}
                        </td>
                        <td className="h-12 border-white border-2 p-2 text-center">
                          {r.additionalDetails || "—"}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="h-12 border-white border-2 p-2 text-center">
                          {r.buildingName || "—"}
                        </td>
                        <td className="h-12 border-white border-2 p-2 text-center">
                          {r.floorLocation || "—"}
                        </td>
                        <td className="h-12 border-white border-2 p-2 text-center">
                          {r.additionalDetails || "—"}
                        </td>
                      </>
                    )}

                    <td className="h-12 border-white border-2 p-2 text-center">
                      {renderUserApprovalChip(r)}
                    </td>

                    <td className="h-12 border-white border-2 p-2 text-center">
                      {formatDateTime(r.resolvedAt || r.serverTimeStamp)}
                    </td>

                    {!hideActions && (
                      <td className="h-12 border-white border-2 p-2 text-center">
                        <div className="flex justify-center items-center gap-2">
                          {/* View Message (only when declined and has userApprovalNotes) */}
                          {isDeclined && hasMsg && (
                            <button
                              onClick={() => handleViewMessage(r)}
                              className="flex items-center gap-1 bg-slate-600 px-3 py-2 rounded text-white font-semibold hover:bg-slate-700 transition-colors"
                              title="View user's decline message"
                            >
                              <MessageSquareText size={16} /> View Message
                            </button>
                          )}

                          {/* Re-process button only if the user declined */}
                          {isDeclined && (
                            <button
                              onClick={() => handleReprocess(r)}
                              className="flex items-center gap-1 bg-yellow-500 px-3 py-2 rounded text-white font-semibold hover:bg-yellow-600 transition-colors"
                              title="Move back to On Process"
                            >
                              <RotateCw size={16} /> Process
                            </button>
                          )}

                          {/* Keep Remove (soft-hide / hard-delete) */}
                          <button
                            onClick={() => handleDelete(r)}
                            className="flex justify-center items-center bg-red-500 px-3 py-2 rounded text-white font-semibold gap-1 hover:bg-red-600 transition-colors"
                            title="Remove (soft-hide or delete if user also removed)"
                          >
                            <Trash2 />
                            Remove
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination anchored under the table */}
      {filtered.length > 0 && (
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

      {/* Download modal */}
      <Download
        open={showDownload}
        onClose={() => setShowDownload(false)}
        context="resolved"
        role={myRole}
        uid={uid}
      />
    </div>
  );
};

export default ResolvedReports;
