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
  const [mode, setMode] = useState("daily"); // "daily" | "monthly"
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10)); // yyyy-mm-dd
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // yyyy-mm
  });

  const [rows, setRows] = useState([]); // printable items after filtering
  const [loading, setLoading] = useState(false);
  const [imgPreview, setImgPreview] = useState(null);

  const containerRef = useRef(null);

  // --- helpers
  const toDate = (ts) => {
    try {
      if (ts && typeof ts.toDate === "function") return ts.toDate();
      if (ts instanceof Date) return ts;
      return null;
    } catch {
      return null;
    }
  };

  const sameDay = (date, ymd) => {
    if (!date) return false;
    const s = ymd.split("-");
    const Y = +s[0],
      M = +s[1],
      D = +s[2];
    return (
      date.getFullYear() === Y &&
      date.getMonth() + 1 === M &&
      date.getDate() === D
    );
  };

  const inMonth = (date, ym) => {
    if (!date) return false;
    const s = ym.split("-");
    const Y = +s[0],
      M = +s[1];
    return date.getFullYear() === Y && date.getMonth() + 1 === M;
  };

  // role → which service types they typically handle (for resolved context)
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

          const allow = allowedTypesForRole(role);
          if (allow.length) {
            data = data.filter((r) => allow.includes(r.serviceType || ""));
          }

          data = data.filter((r) => {
            const dt = toDate(r.resolvedAt || r.serverTimeStamp);
            return mode === "daily" ? sameDay(dt, day) : inMonth(dt, month);
          });

          data.sort((a, b) => {
            const ta =
              a.resolvedAt?.toMillis?.() ??
              a.serverTimeStamp?.toMillis?.() ??
              0;
            const tb =
              b.resolvedAt?.toMillis?.() ??
              b.serverTimeStamp?.toMillis?.() ??
              0;
            return tb - ta;
          });
        } else {
          const snap = await getDocs(query(collection(db, "assetRequests")));
          data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          data = data.filter((r) => {
            const s = (r.status || "").toLowerCase();
            return s === "approved" || s === "declined";
          });
          data = data.filter((r) => {
            const dt =
              toDate(r.approvedAt) ||
              toDate(r.declinedAt) ||
              toDate(r.serverTimeStamp);
            return mode === "daily" ? sameDay(dt, day) : inMonth(dt, month);
          });
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
            return tb - ta;
          });
        }

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
  }, [open, context, role, mode, day, month]);

  const printableTitle = useMemo(() => {
    if (context === "resolved") {
      const group =
        role.includes("CSD")
          ? "CSD Office – Resolved Reports"
          : role.includes("MIS") || role.includes("IT Support")
          ? "MIS Office – Resolved Reports"
          : "Resolved Reports";
      return mode === "daily" ? `${group} (Daily)` : `${group} (Monthly)`;
    } else {
      const group = "Property Custodian – Request Log";
      return mode === "daily" ? `${group} (Daily)` : `${group} (Monthly)`;
    }
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

  const formatYMD = (date) =>
    date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(date.getDate()).padStart(2, "0")}`
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

      // Force white background and higher scale for sharp text
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 1000, // more consistent rendering
      });
      const img = canvas.toDataURL("image/png");
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      if (i > 0) pdf.addPage();
      pdf.addImage(img, "PNG", 0, 0, imgW, Math.min(imgH, pageH));
    }

    const fileLabel = mode === "daily" ? day || "daily" : month || "monthly";
    const base = context === "resolved" ? "ResolvedReports" : "RequestLog";
    pdf.save(`${base}_${fileLabel}.pdf`);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center mt-20 z-50"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 opacity-100"
        onClick={onClose}
      />

      {/* Panel – make it a flex column, so body can flex and scroll */}
      <div className="relative w-[96%] max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header (sticky) */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">
              {context === "resolved" ? "Resolved Reports" : "Request Log"}
            </div>
            <div className="text-lg font-semibold">{printableTitle}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <SettingsMenu
                mode={mode}
                setMode={setMode}
                day={day}
                setDay={setDay}
                month={month}
                setMonth={setMonth}
              />
            </div>

            <button
              onClick={downloadPdf}
              disabled={!rows.length || loading}
              className={`flex items-center gap-2 px-3 py-2 rounded border font-semibold transition-colors ${
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

            <button
              onClick={onClose}
              className="h-9 w-9 inline-flex items-center justify-center rounded-full hover:bg-gray-100"
              aria-label="Close"
            >
              <X />
            </button>
          </div>
        </div>

        {/* Body – flex-1 + overflow to ensure scrolling when many pages */}
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

          {/* Pages */}
          {!loading && rows.length > 0 && (
            <div className="space-y-6">
              {rows.map((r) =>
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
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen image preview */}
      {imgPreview && (
        <div
          className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center"
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

/* ---------- Tiny settings popover (no external lib) ---------- */
const SettingsMenu = ({ mode, setMode, day, setDay, month, setMonth }) => {
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
        className="flex items-center gap-2 px-3 py-2 rounded-full border font-semibold hover:bg-gray-50"
        title="Settings"
      >
        <Settings2 /> Settings
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border p-3 z-20">
          <div className="text-sm font-semibold mb-2">Report Type</div>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setMode("daily")}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                mode === "daily" ? "bg-gray-900 text-white border-gray-900" : ""
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setMode("monthly")}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                mode === "monthly"
                  ? "bg-gray-900 text-white border-gray-900"
                  : ""
              }`}
            >
              Monthly
            </button>
          </div>

          {mode === "daily" ? (
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Pick a date
              </label>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Pick a month
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ---------------------- Shared PDF Header / Footer ---------------------- */
const PdfHeader = () => {
  return (
    <div className="mb-3">
      <div className="relative flex items-center">
        {/* Logo stays fixed at the left */}
        <img
          src={dctLogo}
          alt="DCT Logo"
          className="h-20 w-20 object-contain absolute left-0 top-1/2 -translate-y-1/2"
        />

        {/* Text block is absolutely centered across full width */}
        <div className="w-full text-center leading-tight">
          <div className="text-[15px] tracking-wide font-bold uppercase">
            Dominican College of Tarlac, Inc.
          </div>
          <div className="text-[11px] uppercase">
            College of Computer Studies
          </div>
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
      </div>

      <div className="mt-2 border-t-2 border-black" />
    </div>
  );
};



const PdfFooter = () => {
  return (
    <div className="mt-4">
      <div className="border-t border-black border-2 mb-1" />
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

/* ---------------------- Print page: Resolved Reports ---------------------- */
/** A4-friendly page:
 * - fixed content width ~ 794px (≈ 210mm at 96dpi) for consistent html2canvas
 * - generous spacing; each report intended to fill one page
 */
const ResolvedPage = ({ r, role, formatDateTime, imgClick }) => {
  const heading =
    (r.serviceType || "").includes("Facilities")
      ? "CSD Office – Incident Resolution"
      : (r.serviceType || "").includes("Hardware")
      ? "MIS Office – IT Hardware Resolution"
      : "MIS Office – IT Software Resolution";

  return (
    <div className="print-page bg-white rounded-xl border shadow p-6 w-[794px] mx-auto">
      {/* Header */}
      <PdfHeader />

      {/* Title */}
      <div className="text-lg font-semibold mb-2">{heading}</div>

      {/* Reporter line */}
      <div className="text-sm text-gray-700">
        <span className="font-semibold">{r.userName || "—"}</span>
        <span className="text-gray-400"> • </span>
        <span>{r.userDept || "—"}</span>
        <span className="text-gray-400"> • </span>
        <span>{formatDateTime(r.serverTimeStamp)}</span>
      </div>

      <hr className="my-4 border-gray-200" />

      {/* Body – details + original image (square) */}
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

        {/* Original image – square card */}
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

      {/* Resolution */}
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

      {/* Resolution image – larger square for print, non-stretched */}
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

      {/* Footer */}
      <PdfFooter />
    </div>
  );
};

/* ---------------------- Print page: Request Log (Property Custodian) ---------------------- */
const RequestPage = ({ r, formatDateTime, imgClick }) => {
  const status = (r.status || "").toLowerCase();
  return (
    <div className="print-page bg-white rounded-xl border shadow p-6 w-[794px] mx-auto">
      <PdfHeader />

      <div className="text-lg font-semibold mb-2">
        Property Custodian – Asset Request
      </div>

      {/* Requester line */}
      <div className="text-sm text-gray-700">
        <span className="font-semibold">{r.requesterName || r.userName || "—"}</span>
        <span className="text-gray-400"> • </span>
        <span>{r.requesterDept || r.userDept || "—"}</span>
        <span className="text-gray-400"> • </span>
        <span>{formatDateTime(r.serverTimeStamp)}</span>
      </div>

      <hr className="my-4 border-gray-200" />

      {/* Body */}
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

        {/* Request image – square */}
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

      <PdfFooter />
    </div>
  );
};

export default Download;
