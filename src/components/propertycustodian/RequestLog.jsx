// src/components/custodian/RequestLog.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Search, Download as DownloadIcon, Trash2 } from "lucide-react";
import { db } from "../../config/firebase";
import { collection, onSnapshot, query, doc, deleteDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Swal from "sweetalert2";

// ⬇️ Add this import
import Download from "../admin/Download";

const RequestLog = () => {
  const [reqs, setReqs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All"); // All | Approved | Declined
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // ⬇️ Modal state
  const [showDownload, setShowDownload] = useState(false);

  // role (passed to Download; not used for filtering requests inside Download, but harmless)
  const [myRole, setMyRole] = useState(localStorage.getItem("role") || "");
  useEffect(() => {
    const sync = () => setMyRole(localStorage.getItem("role") || "");
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // uid (optional prop for Download)
  const uid =
    getAuth().currentUser?.uid ||
    localStorage.getItem("uid") ||
    "";

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "assetRequests")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
          const ta =
            a.approvedAt?.toMillis?.() ??
            a.declinedAt?.toMillis?.() ??
            a.serverTimeStamp?.toMillis?.() ??
            0;
          const tb =
            b.approvedAt?.toMillis?.() ??
            b.declinedAt?.toMillis?.() ??
            b.serverTimeStamp?.toMillis?.() ??
            0;
        return tb - ta;
        });
        setReqs(rows);
        setLoading(false);
      },
      (err) => {
        console.error("[RequestLog] onSnapshot error:", err);
        setReqs([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const formatDateTime = (ts) => {
    try {
      const d =
        ts && typeof ts.toDate === "function" ? ts.toDate() :
          ts instanceof Date ? ts : null;
      if (!d) return "—";
      return d.toLocaleString(undefined, {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return "—"; }
  };

  const approvedDeclined = useMemo(() => {
    return reqs.filter((r) => {
      const s = (r.status || "").toLowerCase();
      return s === "approved" || s === "declined";
    });
  }, [reqs]);

  const byStatus = useMemo(() => {
    if (statusFilter === "All") return approvedDeclined;
    const wanted = statusFilter.toLowerCase();
    return approvedDeclined.filter((r) => (r.status || "").toLowerCase() === wanted);
  }, [statusFilter, approvedDeclined]);

  const filtered = useMemo(() => {
    if (!search.trim()) return byStatus;
    const q = search.toLowerCase();
    return byStatus.filter((r) =>
      (r.assetName || "").toLowerCase().includes(q) ||
      (r.reason || "").toLowerCase().includes(q)
    );
  }, [search, byStatus]);

  const handleDelete = async (req) => {
    try {
      const result = await Swal.fire({
        title: "Delete this request?",
        text: "This will permanently remove the request from Request History.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Delete",
      });
      if (!result.isConfirmed) return;

      Swal.fire({
        title: "Deleting...",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      await deleteDoc(doc(db, "assetRequests", req.id));

      Swal.close();
      Swal.fire({
        title: "Deleted",
        text: "The request has been permanently deleted.",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("[RequestLog] delete error:", err);
      Swal.close();
      Swal.fire("Error", "Failed to delete the request.", "error");
    }
  };

  return (
    <div>
      {/* Search Row */}
      <div className="w-full flex items-center justify-center mt-4 gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Asset Name or Reason"
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

      {/* Filter + Download Row */}
      <div className="w-full flex justify-between items-center mt-3">
        {/* Filter dropdown */}
        <div className="flex-col items-center gap-2">
          <label htmlFor="statusFilter" className="text-sm font-semibold">
            Filter by status:
          </label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-black rounded px-2 py-1 text-sm bg-white"
          >
            <option>All</option>
            <option>Approved</option>
            <option>Declined</option>
          </select>
        </div>

        {/* Download button */}
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
            <p className="text-lg font-semibold">Loading Request History...</p>
            <div className="mt-3">
              <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 mt-6 overflow-y-auto pb-28">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
  <thead className="bg-[#494949]">
    <tr>
      <th className="border-white border-2 p-2 text-white text-center">Asset Name</th>
      <th className="border-white border-2 p-2 text-white text-center">Reason</th>
      <th className="border-white border-2 p-2 text-white text-center">Status</th>
      <th className="border-white border-2 p-2 text-white text-center">Requested At</th>
      <th className="border-white border-2 p-2 text-white text-center">Action</th>
    </tr>
  </thead>

  <tbody>
    {filtered.length === 0 ? (
      <tr>
        <td
          colSpan={5}
          className="border-white border-2 p-4 text-center text-gray-500"
        >
          {statusFilter !== "All" || search
            ? "No matching requests."
            : "No approved/declined requests yet."}
        </td>
      </tr>
    ) : (
      filtered.map((r) => (
        <tr
          key={r.id}
          className="odd:bg-[#FFE7F6] even:bg-[#C8C8C8]" // striped rows to match User Management
        >
          <td className="border-white border-2 p-2 text-center">
            {r.assetName || "—"}
          </td>

          <td
            className="border-white border-2 p-2 text-center truncate max-w-[220px]"
            title={r.reason || ""}
          >
            {r.reason || "—"}
          </td>

          <td className="border-white border-2 p-2 text-center">
            {r.status || "—"}
          </td>

          <td className="border-white border-2 p-2 text-center">
            {formatDateTime(r.serverTimeStamp)}
          </td>

          <td className="border-white border-2 p-2 text-center">
            <div className="flex justify-center items-center gap-2">
              {(r.status || "").toLowerCase() === "declined" &&
                (r.declineReason || "").trim() && (
                  <button
                    onClick={() =>
                      Swal.fire({
                        title: "Decline Reason",
                        text: r.declineReason,
                        icon: "info",
                      })
                    }
                    className="px-3 py-2 border rounded hover:bg-gray-100 transition-colors"
                  >
                    View Message
                  </button>
                )}

              <button
                onClick={() => handleDelete(r)}
                className="flex justify-center items-center bg-red-500 px-3 py-2 rounded text-white font-semibold gap-1 hover:bg-red-600 transition-colors"
                title="Delete permanently"
              >
                <Trash2 /> Delete
              </button>
            </div>
          </td>
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
        context="requests"
        role={myRole}
        uid={uid}
      />
    </div>
  );
};

export default RequestLog;
