// src/components/common/Download.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Settings2, FileDown } from "lucide-react";
import { db } from "../../config/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import dctLogo from "../../assets/dctLogo.png";

/**
 * Props:
 *  - open: boolean
 *  - onClose: fn
 *  - context: "resolved" | "requests"
 *  - role: current user's role (string)
 *  - uid:  current user's uid (string)
 */
const Download = ({ open, onClose, context = "resolved", role = "", uid = "" }) => {
  const [mode, setMode] = useState("weekly"); // "weekly" | "monthly"
  const [weekStart, setWeekStart] = useState(() => new Date().toISOString().slice(0, 10)); // yyyy-mm-dd
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // yyyy-mm
  });

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imgPreview, setImgPreview] = useState(null);

  const containerRef = useRef(null);

  // ---- date helpers
  const toDate = (ts) => {
    try {
      if (ts && typeof ts.toDate === "function") return ts.toDate();
      if (ts instanceof Date) return ts;
      return null;
    } catch {
      return null;
    }
  };
  const addDays = (date, n) => {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + n);
    return d;
  };
  const parseYMD = (ymd) => {
    const [y, m, d] = ymd.split("-").map((v) => +v);
    return new Date(y, m - 1, d);
  };
  const sameMonth = (date, ym) => {
    if (!date) return false;
    const [Y, M] = ym.split("-").map((v) => +v);
    return date.getFullYear() === Y && date.getMonth() + 1 === M;
  };
  const inWeekWindow = (date, startYmd) => {
    if (!date) return false;
    const s = parseYMD(startYmd);
    const e = addDays(s, 6);
    return date >= s && date <= e;
  };

  // role → service types
  const allowedTypesForRole = (r) => {
    switch (r) {
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

  // fetch on setting changes
  useEffect(() => {
    if (!open) return;
    let isMounted = true;

    const load = async () => {
      try {
        setLoading(true);
        let data = [];

        if (context === "resolved") {
          const snap = await getDocs(query(collection(db, "resolvedReports")));
          data = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((r) => !r.hiddenForAdmin);

          // include only user-approved resolutions
          data = data.filter(
            (r) => (r.userApprovalStatus || "").toLowerCase() === "approved"
          );

          const allow = allowedTypesForRole(role);
          if (allow.length) {
            data = data.filter((r) => allow.includes(r.serviceType || ""));
          }

          if (mode === "weekly") {
            data = data.filter((r) => {
              const dt = toDate(r.resolvedAt || r.serverTimeStamp);
              return inWeekWindow(dt, weekStart);
            });
          } else {
            data = data.filter((r) => {
              const dt = toDate(r.resolvedAt) || toDate(r.serverTimeStamp);
              return sameMonth(dt, month);
            });
          }

          data.sort((a, b) => {
            const ta =
              a.resolvedAt?.toMillis?.() ??
              a.serverTimeStamp?.toMillis?.() ??
              0;
            const tb =
              b.resolvedAt?.toMillis?.() ??
              b.serverTimeStamp?.toMillis?.() ??
              0;
            return ta - tb; // oldest → newest
          });
        } else {
          const snap = await getDocs(query(collection(db, "assetRequests")));
          data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          data = data.filter((r) => {
            const s = (r.status || "").toLowerCase();
            return s === "approved" || s === "declined";
          });

          if (mode === "weekly") {
            data = data.filter((r) => {
              const dt =
                toDate(r.approvedAt) ||
                toDate(r.declinedAt) ||
                toDate(r.serverTimeStamp);
              return inWeekWindow(dt, weekStart);
            });
          } else {
            data = data.filter((r) => {
              const dt =
                toDate(r.approvedAt) ||
                toDate(r.declinedAt) ||
                toDate(r.serverTimeStamp);
              return sameMonth(dt, month);
            });
          }

          data.sort((a, b) => {
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
            return ta - tb;
          });
        }

        // 🔹 ENRICH WITH USER METADATA (name & department) FOR RELIABLE DISPLAY
        // This ensures Property Custodian pages (and tables) always show a requester/admin name.
        const usersSnap = await getDocs(query(collection(db, "users")));
        const usersById = {};
        usersSnap.forEach((d) => {
          const u = d.data() || {};
          usersById[d.id] = {
            name: u.name || "",
            department: u.department || "",
          };
        });

        data = data.map((r) => {
          const u = usersById[r.uid] || {};
          return {
            ...r,
            userName: r.userName || u.name || "",
            userDept: r.userDept || u.department || "",
            requesterName: r.requesterName || u.name || "",
            requesterDept: r.requesterDept || u.department || "",
          };
        });

        if (!isMounted) return;
        setRows(data);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [open, context, role, mode, weekStart, month]);

  const printableTitle = useMemo(() => {
    const group =
      context === "resolved"
        ? role.includes("CSD")
          ? "CSD Office – Resolved Reports"
          : role.includes("MIS") || role.includes("IT Support")
          ? "MIS Office – Resolved Reports"
          : "Resolved Reports"
        : "Property Custodian – Request Log";
    return mode === "weekly" ? `${group} (Weekly)` : `${group} (Monthly)`;
  }, [context, role, mode]);

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
  const formatDate = (d) =>
    d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`
      : "—";

  // ---- PDF export (A4 portrait)
  const downloadPdf = async () => {
    if (!rows.length || !containerRef.current) return;

    const pages = Array.from(
      containerRef.current.querySelectorAll(".print-page")
    );
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const pageW = 595.28; // A4 width pt
    const pageH = 841.89; // A4 height pt

    for (let i = 0; i < pages.length; i++) {
      const el = pages[i];
      el.style.transform = "scale(1)";

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 1000,
      });
      const img = canvas.toDataURL("image/png");
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      if (i > 0) pdf.addPage();
      pdf.addImage(img, "PNG", 0, 0, imgW, Math.min(imgH, pageH));
    }

    const fileLabel =
      mode === "weekly"
        ? `${formatDate(parseYMD(weekStart))}_to_${formatDate(
            addDays(parseYMD(weekStart), 6)
          )}`
        : month || "monthly";
    const base = context === "resolved" ? "ResolvedReports" : "RequestLog";
    pdf.save(`${base}_${fileLabel}.pdf`);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-2 sm:p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-[96%] max-w-5xl max-h-[85vh] sm:max-h-[90vh] md:max-h-[88vh] lg:max-h-[80vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col overscroll-contain mt-10">
        {/* Header (mobile-friendly) */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 sm:px-6 py-3 relative">
          {/* Close button stays visible */}
          <button
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-12 sm:pr-0">
            {/* Title */}
            <div>
              <div className="text-sm text-gray-500">
                {context === "resolved" ? "Resolved Reports" : "Request Log"}
              </div>
              <div className="text-lg font-semibold">{printableTitle}</div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <SettingsMenu
                mode={mode}
                setMode={setMode}
                weekStart={weekStart}
                setWeekStart={setWeekStart}
                month={month}
                setMonth={setMonth}
              />

              <button
                onClick={downloadPdf}
                disabled={!rows.length || loading}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded border font-semibold transition-colors w-full sm:w-auto lg:mr-10 md:mr-10 ${
                  rows.length && !loading
                    ? "hover:bg-gray-50"
                    : "opacity-60 cursor-not-allowed"
                }`}
                title={
                  rows.length ? "Download PDF" : "No printable data for selected period"
                }
              >
                <FileDown /> Download PDF
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto" ref={containerRef}>
          {loading && (
            <div className="py-16 text-center text-gray-600">
              Preparing preview…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="py-16 text-center text-gray-500">
              No printable records found for the selected period.
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="space-y-6">
              {mode === "weekly" ? (
                rows.map((r) =>
                  context === "resolved" ? (
                    <ResolvedPage
                      key={r.id}
                      r={r}
                      role={role}
                      formatDateTime={formatDateTime}
                      imgClick={(url) => url && setImgPreview(url)}
                    />
                  ) : (
                    <RequestPage
                      key={r.id}
                      r={r}
                      formatDateTime={formatDateTime}
                      imgClick={(url) => url && setImgPreview(url)}
                    />
                  )
                )
              ) : (
                <MonthlySummary context={context} rows={rows} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen image preview */}
      {imgPreview && (
        <div
          className="fixed inset-0 z-[2100] bg-black/80 flex items-center justify-center"
          onClick={() => setImgPreview(null)}
        >
          <img
            src={imgPreview}
            alt="Preview"
            className="max-h-[90%] max-w-[90%] rounded shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

/* ---------- Settings: desktop popover + mobile centered modal ---------- */
const SettingsMenu = ({ mode, setMode, weekStart, setWeekStart, month, setMonth }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-full border font-semibold hover:bg-gray-50 w-full sm:w-auto justify-center"
        title="Settings"
      >
        <Settings2 /> Settings
      </button>

      {/* Desktop popover (right-aligned) */}
      {open && (
        <div className="hidden sm:block absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border p-3 z-[2050]">
          <SettingsPanel
            mode={mode}
            setMode={setMode}
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            month={month}
            setMonth={setMonth}
            close={() => setOpen(false)}
          />
        </div>
      )}

      {/* Mobile centered modal */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-[2100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-lg border p-3 z-[2110]">
            <SettingsPanel
              mode={mode}
              setMode={setMode}
              weekStart={weekStart}
              setWeekStart={setWeekStart}
              month={month}
              setMonth={setMonth}
              close={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const SettingsPanel = ({
  mode,
  setMode,
  weekStart,
  setWeekStart,
  month,
  setMonth,
  close,
}) => {
  const weekStartDate = useMemo(() => new Date(weekStart), [weekStart]);
  const weekEndDate = useMemo(() => {
    if (!weekStartDate || isNaN(+weekStartDate)) return null;
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStartDate]);

  return (
    <div>
      <div className="text-sm font-semibold mb-2">Report Type</div>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode("weekly")}
          className={`px-3 py-1.5 rounded-full text-sm border ${
            mode === "weekly" ? "bg-gray-900 text-white border-gray-900" : ""
          }`}
        >
          Weekly
        </button>
        <button
          onClick={() => setMode("monthly")}
          className={`px-3 py-1.5 rounded-full text-sm border ${
            mode === "monthly" ? "bg-gray-900 text-white border-gray-900" : ""
          }`}
        >
          Monthly
        </button>
      </div>

      {mode === "weekly" ? (
        <div className="space-y-2">
          <label className="block text-xs text-gray-600">Start of week</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          />
          <div className="text-[11px] text-gray-600">
            Range:&nbsp;
            {isNaN(+weekStartDate) ? "—" : weekStartDate.toLocaleDateString()} —{" "}
            {weekEndDate ? weekEndDate.toLocaleDateString() : "—"}
          </div>

          <div className="mt-2 flex justify-end">
            <button
              className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
              onClick={close}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs text-gray-600">Pick a month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          />
          <div className="mt-2 flex justify-end">
            <button
              className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
              onClick={close}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------------- Shared PDF Header / Footer ---------------------- */
const PdfHeader = () => {
  return (
    <div className="mb-3">
      {/* 3-column grid keeps center perfectly centered in canvas/PDF */}
      <div className="grid grid-cols-[100px_1fr_100px] items-center gap-2">
        {/* Left: fixed logo */}
        <div className="flex justify-start">
          <img
            src={dctLogo}
            alt="DCT Logo"
            className="h-20 w-20 object-contain"
          />
        </div>

        {/* Center: institution text */}
        <div className="text-center leading-tight">
          <div className="text-[15px] tracking-wide font-bold uppercase">
            Dominican College of Tarlac, Inc.
          </div>
          <div className="text-[11px] uppercase">College of Computer Studies</div>
          <div className="text-[10px] text-gray-700">
            McArthur Highway, Poblacion (Sto. Rosario), Capas, 2315 Tarlac, Philippines
          </div>
          <div className="text-[10px] text-gray-700">
            Institutional Contact Nos.: +63938-918-4093 • Website: dct.edu.ph
          </div>
          <div className="text-[10px] text-gray-700">
            E-mail: domct_2315@yahoo.com.ph / domct_2315@dct.edu.ph
          </div>
        </div>

        {/* Right: empty spacer to balance the grid */}
        <div />
      </div>

      <div className="mt-2 border-b-2 border-black" />
    </div>
  );
};

const PdfFooter = () => {
  return (
    <div className="mt-4">
      <div className="border-b-2 border-black mb-1" />
      <div className="text-center">
        <div className="text-[11px] font-semibold tracking-wide">
          FIDES. PATRIA. SAPIENTIA.
        </div>
        <div className="text-[10px] italic">
          A God-loving educational community with passion for truth and compassion for humanity.
        </div>
        <div className="text-[10px]">
          Department Office Facebook Page: www.facebook.com/dctccsofficial
        </div>
        <div className="text-[10px]">
          Department/Office E-mail: it.ccs@dct.edu.ph
        </div>
      </div>
    </div>
  );
};

/* ---------------------- A4 Page baseline (same for Weekly & Monthly) --- */
const A4_PAGE =
  "print-page bg-white rounded-xl border shadow p-6 w-[794px] min-h-[1123px] mx-auto flex flex-col";

/* ---------------------- Weekly (per-report pages) ---------------------- */
const ResolvedPage = ({ r, role, formatDateTime, imgClick }) => {
  const heading =
    (r.serviceType || "").includes("Facilities")
      ? "CSD Office – Incident Resolution"
      : (r.serviceType || "").includes("Hardware")
      ? "MIS Office – IT Hardware Resolution"
      : "MIS Office – IT Software Resolution";

  return (
    <div className={A4_PAGE}>
      <PdfHeader />

      <div className="text-lg font-semibold mb-2">{heading}</div>

      <div className="text-sm text-gray-700">
        <span className="font-semibold">{r.userName || "—"}</span>
        <span className="text-gray-400"> • </span>
        <span>{r.userDept || "—"}</span>
        <span className="text-gray-400"> • </span>
        <span>{formatDateTime(r.serverTimeStamp)}</span>
      </div>

      <hr className="my-4 border-gray-200" />

      <div className="grid grid-cols-1 md:grid-cols-[1fr,260px] gap-4">
        <div className="space-y-2 text-sm">
          {(r.serviceType || "").includes("Software") ? (
            <div>
              <span className="font-semibold">Platform / System Name:</span>{" "}
              {r.platformName || r.systemName || r.platform || "—"}
            </div>
          ) : (
            <>
              <div>
                <span className="font-semibold">Building Name:</span>{" "}
                {r.buildingName || "—"}
              </div>
              <div>
                <span className="font-semibold">Floor / Room Location:</span>{" "}
                {r.floorLocation || "—"}
              </div>
            </>
          )}

          <div>
            <span className="font-semibold">Other Details:</span>{" "}
            {r.additionalDetails || "—"}
          </div>
        </div>

        <div className="bg-[#0A1936] p-2 rounded flex items-center justify-center">
          {r.imageUrl ? (
            <img
              src={r.imageUrl}
              alt="Report"
              className="w-[236px] h-[236px] object-contain bg-[#0A1936] rounded cursor-pointer"
              onClick={() => imgClick(r.imageUrl)}
            />
          ) : (
            <div className="w-[236px] h-[236px] rounded bg-[#0A1936] flex items-center justify-center text-[11px] text-white/70">
              No image
            </div>
          )}
        </div>
      </div>

      <hr className="my-4 border-gray-200" />

      <div className="text-xs sm:text-sm text-gray-700 flex flex-wrap items-center gap-x-2">
        <span className="font-semibold">{r.resolvedByName || "—"}</span>
        <span className="text-gray-400">•</span>
        <span>{r.resolvedByDept || "—"}</span>
        <span className="text-gray-400">•</span>
        <span>{formatDateTime(r.resolvedAt || r.serverTimeStamp)}</span>
      </div>

      <div className="mt-2 text-sm">
        <span className="font-semibold">Resolution Summary:</span>{" "}
        {r.resolutionNotes || "—"}
      </div>

      <div className="mt-3 bg-[#0A1936] p-2 rounded flex items-center justify-center">
        {r.resolvedImageUrl ? (
          <img
            src={r.resolvedImageUrl}
            alt="Resolution"
            className="w-[360px] h-[360px] object-contain bg-[#0A1936] rounded cursor-pointer"
            onClick={() => imgClick(r.resolvedImageUrl)}
          />
        ) : (
          <div className="w-[360px] h-[360px] rounded bg-[#0A1936] flex items-center justify-center text-[11px] text-white/70">
            No image
          </div>
        )}
      </div>

      {/* push footer to bottom */}
      <div className="mt-auto" />
      <PdfFooter />
    </div>
  );
};

const RequestPage = ({ r, formatDateTime, imgClick }) => {
  const status = (r.status || "").toLowerCase();
  return (
    <div className={A4_PAGE}>
      <PdfHeader />

      <div className="text-lg font-semibold mb-2">
        Property Custodian – Asset Request
      </div>

      <div className="text-sm text-gray-700">
        {/* requesterName / userName are guaranteed via enrichment */}
        <span className="font-semibold">{r.requesterName || r.userName || "—"}</span>
        <span className="text-gray-400"> • </span>
        <span>{r.requesterDept || r.userDept || "—"}</span>
        <span className="text-gray-400"> • </span>
        <span>{formatDateTime(r.serverTimeStamp)}</span>
      </div>

      <hr className="my-4 border-gray-200" />

      <div className="grid grid-cols-1 md:grid-cols-[1fr,260px] gap-4">
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-semibold">Asset Name:</span>{" "}
            {r.assetName || "—"}
          </div>
          <div>
            <span className="font-semibold">Reason for Using:</span>{" "}
            {r.reason || "—"}
          </div>
          <div>
            <span className="font-semibold">Status:</span>{" "}
            {r.status || "—"}{" "}
            {status === "declined" && (r.declineReason || "").trim() ? (
              <>
                {" "}
                <span className="text-gray-400">•</span>{" "}
                <span className="font-semibold">Reason:</span>{" "}
                {r.declineReason}
              </>
            ) : null}
          </div>
        </div>

        <div className="bg-[#0A1936] p-2 rounded flex items-center justify-center">
          {r.imageUrl ? (
            <img
              src={r.imageUrl}
              alt="Request"
              className="w-[236px] h-[236px] object-contain bg-[#0A1936] rounded cursor-pointer"
              onClick={() => imgClick(r.imageUrl)}
            />
          ) : (
            <div className="w-[236px] h-[236px] rounded bg-[#0A1936] flex items-center justify-center text-[11px] text-white/70">
              No image
            </div>
          )}
        </div>
      </div>

      {/* push footer to bottom */}
      <div className="mt-auto" />
      <PdfFooter />
    </div>
  );
};

/* ---------------------- Monthly summary (text-only) ---------------------- */
const MonthlySummary = ({ context, rows }) => {
  const groups = useMemo(() => {
    const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    rows.forEach((r) => {
      const d =
        context === "resolved"
          ? r.resolvedAt?.toDate?.() || r.serverTimeStamp?.toDate?.() || null
          : r.approvedAt?.toDate?.() ||
            r.declinedAt?.toDate?.() ||
            r.serverTimeStamp?.toDate?.() ||
            null;
      if (!d) return;
      const day = d.getDate();
      const idx = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : day <= 28 ? 4 : 5;
      buckets[idx].push(r);
    });
    return buckets;
  }, [rows, context]);

  const total = rows.length;

  return (
    <div className="print-page bg-white rounded-xl border shadow p-6 w-[794px] min-h-[1123px] mx-auto flex flex-col">
      <PdfHeader />
      <div className="text-xl font-semibold mb-2">
        {context === "resolved" ? "Monthly Record – Resolved Reports" : "Monthly Record – Asset Requests (Approved/Declined)"}
      </div>
      <div className="text-sm text-gray-700 mb-4">
        Total items this month: <span className="font-semibold">{total}</span>
      </div>

      {/* Per-week counts */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <div className="border rounded p-2">Week 1 (1–7): <span className="font-semibold">{groups[1].length}</span></div>
        <div className="border rounded p-2">Week 2 (8–14): <span className="font-semibold">{groups[2].length}</span></div>
        <div className="border rounded p-2">Week 3 (15–21): <span className="font-semibold">{groups[3].length}</span></div>
        <div className="border rounded p-2">Week 4 (22–28): <span className="font-semibold">{groups[4].length}</span></div>
        <div className="border rounded p-2 col-span-2">Week 5 (29–EOM): <span className="font-semibold">{groups[5].length}</span></div>
      </div>

      {/* Records table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1 text-left">#</th>
              <th className="border px-2 py-1 text-left">{context === "resolved" ? "Service Type" : "Status"}</th>
              <th className="border px-2 py-1 text-left">{context === "resolved" ? "Report Date → Resolved" : "Requested → Decision"}</th>
              <th className="border px-2 py-1 text-left">{context === "resolved" ? "Reporter → Resolver" : "Requester"}</th>
              {context === "resolved" ? (
                <th className="border px-2 py-1 text-left">Details</th>
              ) : (
                <th className="border px-2 py-1 text-left">Asset / Reason</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const reportDt = r.serverTimeStamp?.toDate?.() || null;
              const resolvedDt = r.resolvedAt?.toDate?.() || null;

              const reqDt = r.serverTimeStamp?.toDate?.() || null;
              const decisionDt = r.approvedAt?.toDate?.() || r.declinedAt?.toDate?.() || null;

              return (
                <tr key={r.id}>
                  <td className="border px-2 py-1 align-top">{idx + 1}</td>
                  <td className="border px-2 py-1 align-top">
                    {context === "resolved" ? (r.serviceType || "—") : (r.status || "—")}
                  </td>
                  <td className="border px-2 py-1 align-top">
                    {context === "resolved" ? (
                      <>
                        {reportDt ? reportDt.toLocaleDateString() : "—"} →{" "}
                        {resolvedDt ? resolvedDt.toLocaleDateString() : "—"}
                      </>
                    ) : (
                      <>
                        {reqDt ? reqDt.toLocaleDateString() : "—"} →{" "}
                        {decisionDt ? decisionDt.toLocaleDateString() : "—"}
                      </>
                    )}
                  </td>
                  <td className="border px-2 py-1 align-top">
                    {context === "resolved" ? (
                      <>
                        {(r.userName || "—")} → <span className="font-medium">{r.resolvedByName || "—"}</span>
                      </>
                    ) : (
                      r.requesterName || r.userName || "—"
                    )}
                  </td>
                  <td className="border px-2 py-1 align-top">
                    {context === "resolved"
                      ? (r.additionalDetails || r.platformName || r.systemName || "—")
                      : (<>{(r.assetName || "—")}{r.reason ? <> — <span className="italic">{r.reason}</span></> : null}</>)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* push footer to bottom */}
      <div className="mt-auto" />
      <PdfFooter />
    </div>
  );
};

export default Download;
