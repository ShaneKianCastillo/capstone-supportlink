import React, { useEffect, useMemo, useRef, useState } from "react";
import { Forward, X, User } from "lucide-react";
import { db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  query,
  doc,
  writeBatch,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import Swal from "sweetalert2";

const PAGE_SIZE = 6;

const SentReports = () => {
  // --- service types & office labels
  const SERVICE_TYPES = [
    "Facilities and Maintenance",
    "IT Support Services - Hardware",
    "IT Support Services - Software",
  ];

  const officeLabelFor = (serviceType) => {
    switch (serviceType) {
      case "Facilities and Maintenance":
        return "CSD Office";
      case "IT Support Services - Hardware":
        return "MIS — Hardware Office";
      case "IT Support Services - Software":
        return "MIS — Software Office";
      default:
        return "Target Office";
    }
  };

  // Viewer modes for modal content
  const VIEW = { FM: "FM", HW: "HW", SW: "SW" };

  const viewModeFor = (role, serviceType) => {
    switch (role) {
      case "CSD Admin":
      case "CSD Asst. Admin":
        return VIEW.FM;
      case "IT Support Specialist":
        return VIEW.HW;
      case "MIS Admin":
      case "MIS Asst. Admin":
        return VIEW.SW;
      case "Admin":
        if (serviceType === "Facilities and Maintenance") return VIEW.FM;
        if (serviceType === "IT Support Services - Hardware") return VIEW.HW;
        return VIEW.SW;
      default:
        if (serviceType === "Facilities and Maintenance") return VIEW.FM;
        if (serviceType === "IT Support Services - Hardware") return VIEW.HW;
        return VIEW.SW;
    }
  };

  const badgeForType = (serviceType) => {
    const base =
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold";
    if (serviceType === "Facilities and Maintenance")
      return `${base} bg-emerald-100 text-emerald-800`;
    if (serviceType === "IT Support Services - Hardware")
      return `${base} bg-indigo-100 text-indigo-800`;
    return `${base} bg-amber-100 text-amber-800`; // Software
  };

  const [reports, setReports] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // who am I?
  const [myRole, setMyRole] = useState(localStorage.getItem("role") || "");
  useEffect(() => {
    const sync = () => setMyRole(localStorage.getItem("role") || "");
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // modal state
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [processing, setProcessing] = useState(false);

  // per-row forward loading
  const [forwardingId, setForwardingId] = useState(null);

  // image preview overlay (for avatar or report image)
  const [imgPreviewUrl, setImgPreviewUrl] = useState(null);
  const openPreview = (url) => url && setImgPreviewUrl(url);
  const closePreview = () => setImgPreviewUrl(null);

  // keep your press-and-hold too (optional)
  const [showImageFull, setShowImageFull] = useState(false);
  const imgTimerRef = useRef(null);
  const holdToOpen = () => {
    imgTimerRef.current = setTimeout(() => setShowImageFull(true), 500);
  };
  const releaseHold = () => clearTimeout(imgTimerRef.current);

  // role → allowed service types
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
          "IT Support Services - Software",
          "IT Support Services - Hardware",
        ];
      default:
        return [];
    }
  };
  const allowedTypes = allowedTypesForRole(myRole);

  // Live map of users
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "users")),
      (snap) => {
        const map = {};
        snap.forEach((d) => (map[d.id] = { id: d.id, ...d.data() }));
        setUsersById(map);
        setLoadingUsers(false);
      },
      (err) => {
        console.error("[SentReports] users onSnapshot error:", err);
        setUsersById({});
        setLoadingUsers(false);
      }
    );
    return () => unsub();
  }, []);

  // Live list of reports
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "userReport")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
          const ta = a.serverTimeStamp?.toMillis?.() ?? 0;
          const tb = b.serverTimeStamp?.toMillis?.() ?? 0;
          return tb - ta; // newest first
        });
        setReports(rows);
        setLoadingReports(false);
      },
      (err) => {
        console.error("[SentReports] reports onSnapshot error:", err);
        setReports([]);
        setLoadingReports(false);
      }
    );
    return () => unsub();
  }, []);

  const loading = loadingReports || loadingUsers;

  const toDate = (ts) =>
    ts && typeof ts.toDate === "function"
      ? ts.toDate()
      : ts instanceof Date
      ? ts
      : null;

  const formatDateTime = (ts) => {
    try {
      const d = toDate(ts);
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

  // combine report with live user info (incl. photo)
  const combined = useMemo(() => {
    return reports.map((r) => {
      const u = usersById[r.uid] || {};
      return {
        ...r,
        userName: u.name || "—",
        userDept: u.department || "—",
        userRole: u.role || "—",
        userPhotoUrl: u.photoUrl || "", // 👈 pull avatar from users/{uid}
      };
    });
  }, [reports, usersById]);

  // 🔐 role-based filtering by serviceType
  const scoped = useMemo(() => {
    if (!allowedTypes.length) return [];
    return combined.filter((r) => allowedTypes.includes(r.serviceType || ""));
  }, [combined, allowedTypes]);

  // ---------------- Filters & Sort State ----------------
  const [q, setQ] = useState(""); // search
  const [sort, setSort] = useState("newest"); // newest | oldest | nameAsc | nameDesc
  const [from, setFrom] = useState(""); // yyyy-mm-dd
  const [to, setTo] = useState("");

  const resetFilters = () => {
    setQ("");
    setSort("newest");
    setFrom("");
    setTo("");
  };

  // Apply filtering & sorting
  const filtered = useMemo(() => {
    let rows = [...scoped];

    // date range filter
    if (from) {
      const fromDate = new Date(from);
      rows = rows.filter((r) => {
        const d = toDate(r.serverTimeStamp);
        return d ? d >= fromDate : false;
      });
    }
    if (to) {
      const toEdge = new Date(to);
      toEdge.setDate(toEdge.getDate() + 1);
      rows = rows.filter((r) => {
        const d = toDate(r.serverTimeStamp);
        return d ? d < toEdge : false;
      });
    }

    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter((r) => {
        const fields = [
          r.userName,
          r.userDept,
          r.additionalDetails,
          r.platformName,
          r.systemName,
          r.platform,
          r.buildingName,
          r.floorLocation,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return fields.includes(needle);
      });
    }

    // sorting
    rows.sort((a, b) => {
      if (sort === "oldest") {
        const ta = a.serverTimeStamp?.toMillis?.() ?? 0;
        const tb = b.serverTimeStamp?.toMillis?.() ?? 0;
        return ta - tb;
      }
      if (sort === "nameAsc" || sort === "nameDesc") {
        const na = (a.userName || "").toLowerCase();
        const nb = (b.userName || "").toLowerCase();
        const cmp = na.localeCompare(nb);
        return sort === "nameAsc" ? cmp : -cmp;
      }
      // newest
      const ta = a.serverTimeStamp?.toMillis?.() ?? 0;
      const tb = b.serverTimeStamp?.toMillis?.() ?? 0;
      return tb - ta;
    });

    return rows;
  }, [scoped, from, to, q, sort]);

  // counts
  const totalCount = scoped.length;
  const filteredCount = filtered.length;

  // ---------- Pagination ----------
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [q, from, to, sort]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const startIdx = (page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const openModal = (report) => {
    setSelected(report);
    setOpen(true);
    setShowImageFull(false);
  };

  // ➜ MOVE report to "onProcess" and remove from "userReport"
  const handleProcess = async (report) => {
    if (!report?.id) return;
    setProcessing(true);
    try {
      const batch = writeBatch(db);
      const fromRef = doc(db, "userReport", report.id);
      const toRef = doc(db, "onProcess", report.id);
      const { id, ...rest } = report;

      batch.set(
        toRef,
        {
          ...rest,
          sourceReportId: id,
          processedAt: serverTimestamp(),
          status: "On Process",
        },
        { merge: true }
      );
      batch.delete(fromRef);
      await batch.commit();
      setOpen(false);
      setSelected(null);
    } catch (err) {
      console.error("[SentReports] handleProcess error:", err);
    } finally {
      setProcessing(false);
    }
  };

  // ➜ FORWARD report between departments by selecting any service type
  const handleForward = async (report) => {
    if (!report?.id) return;

    const choices = SERVICE_TYPES.filter(
      (t) => t !== (report.serviceType || "")
    );

    const inputOptions = {};
    choices.forEach((t) => {
      inputOptions[t] =
        t === "Facilities and Maintenance"
          ? "Facilities & Maintenance (CSD)"
          : t === "IT Support Services - Hardware"
          ? "IT Support — Hardware (MIS)"
          : "IT Support — Software (MIS)";
    });

    const { value: pickedType, isConfirmed } = await Swal.fire({
      title: "Forward Report",
      input: "radio",
      inputOptions,
      inputValidator: (v) =>
        !v ? "Please select a destination category." : undefined,
      showCancelButton: true,
      confirmButtonText: "Forward",
    });
    if (!isConfirmed) return;

    if (pickedType === report.serviceType) return;

    const targetOffice = officeLabelFor(pickedType);
    const result = await Swal.fire({
      title: "Confirm Forward",
      text: `Forward this report to ${targetOffice} as "${pickedType}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, forward",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;

    try {
      setForwardingId(report.id);
      Swal.fire({
        title: "Forwarding...",
        text: "Reassigning the report to the selected office.",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      const ref = doc(db, "userReport", report.id);
      await updateDoc(ref, { serviceType: pickedType });

      Swal.close();
      await Swal.fire({
        title: "Forwarded",
        text: `Report forwarded to ${targetOffice}.`,
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("[SentReports] forward error:", err);
      Swal.close();
      Swal.fire("Error", "Failed to forward the report.", "error");
    } finally {
      setForwardingId(null);
    }
  };

  return (
    <div className="pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-semibold">Sent Report List</h1>
        <div className="text-sm text-gray-600">
          Showing <span className="font-semibold">{filteredCount}</span> of{" "}
          <span className="font-semibold">{totalCount}</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="mt-4 bg-white rounded-xl border-2 border-[#1C1D21] shadow-sm p-3 sm:p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, department, details…"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* From */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border rounded px-2 py-2 text-sm"
            />
          </div>

          {/* To */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border rounded px-2 py-2 text-sm"
            />
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full border rounded px-2 py-2 text-sm bg-white"
            >
              <option value="newest">Newest → Oldest</option>
              <option value="oldest">Oldest → Newest</option>
              <option value="nameAsc">Reporter A → Z</option>
              <option value="nameDesc">Reporter Z → A</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={resetFilters}
            className="px-3 py-2 text-sm rounded border hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-6 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="font-semibold">Loading reports...</p>
            <div className="mt-3 animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="mt-6 text-gray-600 text-center">
          {scoped.length === 0
            ? "No reports are currently available."
            : (q.trim() || from || to)
            ? "No reports matched your filters."
            : "No reports are currently available."}
        </div>
      )}

      {/* List (paged) */}
      {!loading && filtered.length > 0 && (
        <>
          <div className="mt-6 space-y-3">
            {pageRows.map((r) => (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[whitesmoke] border-2 border-[#1C1D21] px-4 py-3 rounded"
              >
                {/* LEFT: avatar + name line */}
                <div className="flex items-center gap-3">
                  {/* Circle avatar (clickable if has photo) */}
                  <div
                    className="h-10 w-10 rounded-full overflow-hidden bg-gray-300 flex items-center justify-center shrink-0 cursor-pointer"
                    onClick={() => r.userPhotoUrl && openPreview(r.userPhotoUrl)}
                    title={r.userPhotoUrl ? "View reporter photo" : ""}
                  >
                    {r.userPhotoUrl ? (
                      <img
                        src={r.userPhotoUrl}
                        alt={`${r.userName || "Reporter"} avatar`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="text-gray-600" size={20} />
                    )}
                  </div>

                  <p className="text-sm sm:text-base text-black">
                    <span className="font-semibold">{r.userName}</span> — {r.userDept} —{" "}
                    {formatDateTime(r.serverTimeStamp)}
                  </p>
                </div>

                {/* RIGHT: type + actions */}
                <div className="flex items-center gap-3">
                  <span className={badgeForType(r.serviceType)}>{r.serviceType}</span>
                  <button
                    onClick={() => openModal(r)}
                    className="font-semibold underline underline-offset-4 text-black"
                  >
                    View Report
                  </button>
                  <button
                    title="Forward"
                    onClick={() => handleForward(r)}
                    disabled={forwardingId === r.id}
                    className={`p-2 rounded transition-colors text-black ${
                      forwardingId === r.id
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:bg-white/10"
                    }`}
                    aria-label="Forward to the other department"
                  >
                    <Forward />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-4 flex flex-wrap justify-center items-center gap-2">
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
        </>
      )}

      {/* Modal */}
      {open && selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pt-10">
          {/* Backdrop */}
          <div onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50" />

          {/* Panel */}
          <div
            className="relative bg-white rounded-2xl shadow-lg w-full max-w-lg p-6 transform transition-all duration-300 -translate-y-10 animate-slide-in"
            style={{ animation: "slideIn 0.3s ease-out forwards" }}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold mb-1">Report Details</h2>
            <div className="mb-3">
              <span className={badgeForType(selected.serviceType)}>
                {selected.serviceType || "—"}
              </span>
            </div>

            {/* User line */}
            <div className="text-sm text-gray-600 mb-4">
              <span className="font-semibold">{selected.userName}</span> •{" "}
              {selected.userDept} • {formatDateTime(selected.serverTimeStamp)}
            </div>

            {/* Image – press & hold or click to view full */}
            {selected.imageUrl && (
              <div className="mb-4 rounded overflow-hidden border">
                <img
                  src={selected.imageUrl}
                  alt="Report"
                  className="w-full h-56 object-cover select-none cursor-pointer"
                  onMouseDown={holdToOpen}
                  onMouseUp={releaseHold}
                  onMouseLeave={releaseHold}
                  onTouchStart={holdToOpen}
                  onTouchEnd={releaseHold}
                  onClick={() => openPreview(selected.imageUrl)}
                />
              </div>
            )}

            {/* Fields (role-adaptive) */}
            {(() => {
              const mode = viewModeFor(myRole, selected.serviceType);
              const common = (
                <div>
                  <span className="font-semibold">Other Details:</span>{" "}
                  {selected.additionalDetails || "—"}
                </div>
              );

              if (mode === VIEW.SW) {
                const platform =
                  selected.platformName ||
                  selected.systemName ||
                  selected.platform ||
                  "—";
                return (
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-semibold">Platform / System Name:</span>{" "}
                      {platform}
                    </div>
                    {common}
                  </div>
                );
              }

              return (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Building Name:</span>{" "}
                    {selected.buildingName || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Floor / Room Location:</span>{" "}
                    {selected.floorLocation || "—"}
                  </div>
                  {common}
                </div>
              );
            })()}

            <div className="pt-5">
              <button
                onClick={() => handleProcess(selected)}
                disabled={processing}
                className="bg-[#F2B611] text-white p-2 w-full rounded hover:bg-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {processing ? "Processing..." : "Process"}
              </button>
            </div>
          </div>

          {/* Slide animation */}
          <style>{`
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(-50px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Optional: long-press full image overlay */}
          {showImageFull && selected?.imageUrl && (
            <div
              className="fixed inset-0 bg-black/80 flex justify-center items-center z-[60]"
              onClick={() => setShowImageFull(false)}
            >
              <img
                src={selected.imageUrl}
                alt="Full Preview"
                className="max-h-[90%] max-w-[90%] rounded"
              />
            </div>
          )}
        </div>
      )}

      {/* Full-screen image preview overlay (avatar or report image) */}
      {imgPreviewUrl && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center"
          onClick={closePreview}
        >
          <img
            src={imgPreviewUrl}
            alt="Preview"
            className="max-h-[90%] max-w-[90%] rounded shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

export default SentReports;
