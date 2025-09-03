import React, { useEffect, useMemo, useState } from "react";
import { Search, Download, Trash2 } from "lucide-react";
import { db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  query,
  doc,
  deleteDoc,
} from "firebase/firestore";
import Swal from "sweetalert2";

const ResolvedReports = () => {
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // current role
  const [myRole, setMyRole] = useState(localStorage.getItem("role") || "");
  useEffect(() => {
    const sync = () => setMyRole(localStorage.getItem("role") || "");
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // roles → allowed service types & hide actions for assistant admins
  const allowedTypesForRole = (role) => {
    if (role === "CSD Admin" || role === "CSD Asst. Admin") {
      return ["Facilities and Maintenance"];
    }
    if (role === "MIS Admin" || role === "MIS Asst. Admin") {
      return ["IT Support Services"];
    }
    if (role === "Admin") {
      return ["Facilities and Maintenance", "IT Support Services"];
    }
    return [];
  };
  const allowedTypes = allowedTypesForRole(myRole);

  const hideActions = myRole === "MIS Asst. Admin" || myRole === "CSD Asst. Admin";
  const COLS = hideActions ? 4 : 5; // for empty-state colSpan & header count

  // live subscribe to resolvedReports
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "resolvedReports")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // newest resolved first
        rows.sort((a, b) => {
          const ra = a.resolvedAt?.toMillis?.() ?? a.serverTimeStamp?.toMillis?.() ?? 0;
          const rb = b.resolvedAt?.toMillis?.() ?? b.serverTimeStamp?.toMillis?.() ?? 0;
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

  // 1) role-based filter by serviceType
  const roleFiltered = useMemo(() => {
    if (!allowedTypes.length) return [];
    return reports.filter((r) => allowedTypes.includes(r.serviceType || ""));
  }, [reports, allowedTypes]);

  // 2) search filter by building / floor location / description
  const filtered = useMemo(() => {
    if (!search.trim()) return roleFiltered;
    const q = search.toLowerCase();
    return roleFiltered.filter((r) => {
      return (
        (r.buildingName || "").toLowerCase().includes(q) ||
        (r.floorLocation || "").toLowerCase().includes(q) ||
        (r.additionalDetails || "").toLowerCase().includes(q)
      );
    });
  }, [search, roleFiltered]);

  const handleDelete = async (report) => {
    try {
      const result = await Swal.fire({
        title: "Delete this report?",
        text: "This will permanently remove the report from Resolved Reports.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Delete",
      });
      if (!result.isConfirmed) return;

      // show loading
      Swal.fire({
        title: "Deleting...",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      await deleteDoc(doc(db, "resolvedReports", report.id));

      Swal.close();
      Swal.fire({
        title: "Deleted",
        text: "The report has been permanently deleted.",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("[ResolvedReports] delete error:", err);
      Swal.close();
      Swal.fire("Error", "Failed to delete the report.", "error");
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
            onClick={() => setSearch((s) => s)} // noop; kept for UX symmetry
            className="p-2 border-2 border-black rounded hover:bg-gray-100 transition-colors"
            aria-label="Search"
          >
            <Search />
          </button>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button
          className="flex justify-center items-center rounded border-2 border-black px-3 py-2 font-semibold gap-2 w-full lg:w-auto"
          disabled
          title="Coming soon"
        >
          Download <Download />
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
                <th className="border-black border-2 p-2 text-center">Date Submitted</th>
                {!hideActions && (
                  <th className="border-black border-2 p-2 text-center">Action</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="border-black border-2 p-4 text-center text-gray-500">
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
                    <td className="border-black border-2 p-2 text-center">{r.buildingName || "—"}</td>
                    <td className="border-black border-2 p-2 text-center">{r.floorLocation || "—"}</td>
                    <td className="border-black border-2 p-2 text-center">{r.additionalDetails || "—"}</td>
                    <td className="border-black border-2 p-2 text-center">
                      {formatDateTime(r.serverTimeStamp)}
                    </td>

                    {/* Actions (hidden for assistant admins) */}
                    {!hideActions && (
                      <td className="border-black border-2 p-2 text-center">
                        <div className="flex justify-center items-center">
                          <button
                            onClick={() => handleDelete(r)}
                            className="flex justify-center items-center bg-red-500 px-3 py-3 rounded text-white font-semibold gap-1 hover:bg-red-600 transition-colors"
                            title="Delete permanently"
                          >
                            <Trash2 />Delete
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
    </div>
  );
};

export default ResolvedReports;
