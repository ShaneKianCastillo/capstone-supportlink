import React, { useEffect, useMemo, useState } from "react";
import { Search, Download as DownloadIcon, Trash2 } from "lucide-react";
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
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Swal from "sweetalert2";

// ⬇️ Add this import
import Download from "./Download";

const ResolvedReports = () => {
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // ⬇️ Modal state
  const [showDownload, setShowDownload] = useState(false);

  // current role
  const [myRole, setMyRole] = useState(localStorage.getItem("role") || "");
  useEffect(() => {
    const sync = () => setMyRole(localStorage.getItem("role") || "");
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // current uid (for completeness; Download accepts it)
  const uid =
    getAuth().currentUser?.uid ||
    localStorage.getItem("uid") ||
    "";

  // roles → allowed service types & hide actions for assistant admins
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
  const COLS = hideActions ? 4 : 5;

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

  const roleFiltered = useMemo(() => {
    if (!allowedTypes.length) return [];
    return reports.filter((r) => allowedTypes.includes(r.serviceType || ""));
  }, [reports, allowedTypes]);

  const roleAndAdminFiltered = useMemo(() => {
    return roleFiltered.filter((r) => !r.hiddenForAdmin);
  }, [roleFiltered]);

  const filtered = useMemo(() => {
    if (!search.trim()) return roleAndAdminFiltered;
    const q = search.toLowerCase();
    return roleAndAdminFiltered.filter((r) => {
      return (
        (r.buildingName || "").toLowerCase().includes(q) ||
        (r.floorLocation || "").toLowerCase().includes(q) ||
        (r.additionalDetails || "").toLowerCase().includes(q)
      );
    });
  }, [search, roleAndAdminFiltered]);

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
          text:
            "This report is succesfully removed from the Resolved Report List",
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
            placeholder="Search by Building, Floor Location, or Description"
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

      <div className="flex justify-end mt-4">
        <button
          onClick={() => setShowDownload(true)}
          className="flex justify-center items-center rounded border-2 border-black px-3 py-2 font-semibold gap-2 w-full lg:w-auto"
          title="Download printable PDF"
        >
          Download <DownloadIcon />
        </button>
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

      <div className="flex-1 min-h-0 mt-6 overflow-y-auto pb-28">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-[#F2B611]">
              <tr>
                <th className="border-black border-2 p-2 text-center">Building</th>
                <th className="border-black border-2 p-2 text-center">Floor Location</th>
                <th className="border-black border-2 p-2 text-center">Description</th>
                <th className="border-black border-2 p-2 text-center">Date Resolved</th>
                {!hideActions && (
                  <th className="border-black border-2 p-2 text-center">Action</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLS}
                    className="border-black border-2 p-4 text-center text-gray-500"
                  >
                    {allowedTypes.length === 0
                      ? "No reports available for your role."
                      : search
                      ? "No matching reports."
                      : "No resolved reports yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="border-black border-2 p-2 text-center">
                      {r.buildingName || "—"}
                    </td>
                    <td className="border-black border-2 p-2 text-center">
                      {r.floorLocation || "—"}
                    </td>
                    <td className="border-black border-2 p-2 text-center">
                      {r.additionalDetails || "—"}
                    </td>
                    <td className="border-black border-2 p-2 text-center">
                      {formatDateTime(r.resolvedAt || r.serverTimeStamp)}
                    </td>
                    {!hideActions && (
                      <td className="border-black border-2 p-2 text-center">
                        <div className="flex justify-center items-center">
                          <button
                            onClick={() => handleDelete(r)}
                            className="flex justify-center items-center bg-red-500 px-3 py-3 rounded text-white font-semibold gap-1 hover:bg-red-600 transition-colors"
                            title="Remove (soft-hide or delete if user also removed)"
                          >
                            <Trash2 />
                            Remove
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ⬇️ Download modal */}
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
