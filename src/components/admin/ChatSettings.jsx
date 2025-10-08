// src/components/admin/ChatSettings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { BotMessageSquare, Edit, Trash2, PlusCircle, Search } from "lucide-react";
import { db } from "../../config/firebase";
import {
  collection, onSnapshot, query, orderBy, addDoc, serverTimestamp,
  doc, updateDoc, deleteDoc
} from "firebase/firestore";
import Swal from "sweetalert2";

const PAGE_SIZE = 5;

const ROLE_FILTER_OPTIONS = [
  "All",
  "MIS Admin",
  "IT Support Specialist",
];

const ChatSettings = () => {
  // who am I?
  const uid  = (localStorage.getItem("uid")  || "").trim();
  const name = (localStorage.getItem("name") || "").trim();
  const role = (localStorage.getItem("role") || "").trim();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [q, setQ] = useState("");
  const [a, setA] = useState("");

  // edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");

  // filters + pagination
  const [searchText, setSearchText] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("All");
  const [page, setPage] = useState(1);

  // live subscribe
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "chatbotPresets"), orderBy("createdAt", "desc")),
      snap => {
        setList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      err => {
        console.error("[ChatSettings] onSnapshot error:", err);
        setList([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const canEdit = (row) => row.createdByUid === uid;

  const handleAdd = async (e) => {
    e.preventDefault();
    const question = q.trim();
    const lines = a.split("\n").map(s => s.trim()).filter(Boolean);

    if (!question || lines.length === 0) {
      Swal.fire("Missing info", "Enter a question and at least one solution step.", "info");
      return;
    }

    try {
      await addDoc(collection(db, "chatbotPresets"), {
        question,
        answers: lines,
        createdAt: serverTimestamp(),
        createdByUid: uid,
        createdByName: name || "—",
        createdByRole: role || "—",
      });
      setQ("");
      setA("");
      Swal.fire("Added", "New preset has been added.", "success");
    } catch (err) {
      console.error("[ChatSettings] add error:", err);
      Swal.fire("Error", "Failed to add preset.", "error");
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditQ(row.question || "");
    setEditA((row.answers || []).join("\n"));
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editRow) return;
    if (!canEdit(editRow)) {
      Swal.fire("Not allowed", "You can edit only the items you created.", "info");
      return;
    }
    const question = editQ.trim();
    const lines = editA.split("\n").map(s => s.trim()).filter(Boolean);
    if (!question || lines.length === 0) {
      Swal.fire("Missing info", "Enter a question and at least one solution step.", "info");
      return;
    }
    try {
      await updateDoc(doc(db, "chatbotPresets", editRow.id), {
        question,
        answers: lines,
      });
      setEditOpen(false);
      setEditRow(null);
      Swal.fire("Saved", "Preset updated.", "success");
    } catch (err) {
      console.error("[ChatSettings] update error:", err);
      Swal.fire("Error", "Failed to save preset.", "error");
    }
  };

  const handleDelete = async (row) => {
    if (!canEdit(row)) {
      Swal.fire("Not allowed", "You can delete only the items you created.", "info");
      return;
    }
    const res = await Swal.fire({
      title: "Delete preset?",
      text: "This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
    });
    if (!res.isConfirmed) return;

    try {
      await deleteDoc(doc(db, "chatbotPresets", row.id));
      Swal.fire("Deleted", "Preset removed.", "success");
    } catch (err) {
      console.error("[ChatSettings] delete error:", err);
      Swal.fire("Error", "Failed to delete.", "error");
    }
  };

  // ── Filtering + search ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return list.filter(row => {
      // Created by filter
      if (createdByFilter === "Me") {
        if (row.createdByUid !== uid) return false;
      } else if (createdByFilter !== "All") {
        if ((row.createdByRole || "") !== createdByFilter) return false;
      }

      if (!q) return true;

      const hay =
        (row.question || "").toLowerCase() +
        " " +
        (row.answers || []).join(" ").toLowerCase();

      return hay.includes(q);
    });
  }, [list, searchText, createdByFilter, uid]);

  // reset to first page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [searchText, createdByFilter]);

  // pagination math
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIdx = (page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 rounded-full bg-pink-600 items-center justify-center text-white">
            <BotMessageSquare size={18} />
          </span>
          <h1 className="text-xl sm:text-2xl font-semibold">IT HelpBot Settings</h1>
        </div>
      </div>

      {/* Add new preset */}
      <form
        onSubmit={handleAdd}
        className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr,1fr,auto] gap-3 items-start"
      >
        <div className="w-full">
          <label className="block text-sm font-semibold mb-1">Predefined Question</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="text"
            placeholder="e.g., Printer won’t print"
            className="w-full border border-black rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="w-full">
          <label className="block text-sm font-semibold mb-1">
            Solution (steps, one per line)
          </label>
          <textarea
            value={a}
            onChange={(e) => setA(e.target.value)}
            rows={4}
            placeholder={`1) Step A\n2) Step B\n3) Step C`}
            className="w-full border border-black rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="flex lg:block">
          <button
            type="submit"
            className="mt-6 lg:mt-[26px] inline-flex items-center gap-2 bg-[#0A1936] text-white px-4 py-2 rounded hover:bg-[#11254f]"
            title="Add preset"
          >
            <PlusCircle size={18} /> Add
          </button>
        </div>
      </form>

      {/* Filters toolbar */}
      <div className="mt-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by question or solution"
            className="w-full md:w-auto flex-1 border-2 border-black rounded px-3 py-2 text-sm"
          />
          <button
            type="button"
            className="p-2 border-2 border-black rounded hover:bg-gray-100 transition-colors"
            title="Search"
          >
            <Search size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold">Created by</label>
          <select
            value={createdByFilter}
            onChange={(e) => setCreatedByFilter(e.target.value)}
            className="border-2 border-black rounded px-2 py-2 text-sm bg-white"
          >
            {ROLE_FILTER_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Presets table */}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-[#494949]">
            <tr>
              <th className="border-white text-white border-2 p-2 text-center">Question</th>
              <th className="border-white text-white border-2 p-2 text-center">Solution (preview)</th>
              <th className="border-white text-white border-2 p-2 text-center">Created By</th>
              <th className="border-white text-white border-2 p-2 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="border-white border-2 p-4 text-center text-gray-500" colSpan={4}>
                  Loading…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td className="border-white border-2 p-4 text-center text-gray-500" colSpan={4}>
                  {filtered.length === 0 ? "No presets found." : "No items on this page."}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.id} className="odd:bg-[#FFE7F6] even:bg-[#C8C8C8]">
                  <td className="border-white border-2 p-2 text-sm">
                    {row.question || "—"}
                  </td>

                  <td className="border-white border-2 p-2 text-sm">
                    {(row.answers || []).slice(0, 3).join(" • ")}
                    {(row.answers || []).length > 3 ? " …" : ""}
                  </td>

                  <td className="border-white border-2 p-2 text-center text-sm">
                    {(row.createdByName || "—")} <span className="text-gray-500">•</span>{" "}
                    {(row.createdByRole || "—")}
                  </td>

                  <td className="border-white border-2 p-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(row)}
                        disabled={!canEdit(row)}
                        className={`px-3 py-1 rounded text-white flex items-center gap-1 ${
                          canEdit(row)
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "bg-gray-400 cursor-not-allowed"
                        }`}
                        title={canEdit(row) ? "Edit" : "You can only edit your own"}
                      >
                        <Edit size={16} /> Edit
                      </button>

                      <button
                        onClick={() => handleDelete(row)}
                        disabled={!canEdit(row)}
                        className={`px-3 py-1 rounded text-white flex items-center gap-1 ${
                          canEdit(row)
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-gray-400 cursor-not-allowed"
                        }`}
                        title={canEdit(row) ? "Delete" : "You can only delete your own"}
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination (always shows max 5 per page) */}
      {!loading && filtered.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center items-center gap-2">
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

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-[95vw] max-w-2xl p-5">
            <h3 className="text-lg font-semibold mb-3">Edit Preset</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Question</label>
                <input
                  value={editQ}
                  onChange={(e) => setEditQ(e.target.value)}
                  type="text"
                  className="w-full border border-black rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Solution (steps)</label>
                <textarea
                  value={editA}
                  onChange={(e) => setEditA(e.target.value)}
                  rows={6}
                  className="w-full border border-black rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 rounded border hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="px-4 py-2 rounded bg-[#0A1936] text-white hover:bg-[#11254f]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatSettings;
