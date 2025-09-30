// src/components/.../ChatBot.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BotMessageSquare } from "lucide-react";

// 🔹 import Firestore + your db
import { db } from "../../config/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

const NOTE =
  'NOTE: If any step is not possible in your room (or the issue persists), please submit a manual report and choose the service type "IT Support Services." Do NOT open the system unit.';

const PRESET_QA = [
  {
    q: "PC won’t turn on", a: [
      "1) Check power: Ensure the AVR/extension and wall outlet switches are ON.",
      "2) Cables: Firmly reseat the PC power cable and monitor power cable.",
      "3) Power button: Hold for 5 seconds, then press once to start.",
      "4) Power indicators: If no lights/fans at all, move the plug to a known working outlet/AVR port.",
      NOTE,
    ]
  },
  {
    q: "No display on monitor/projector", a: [
      "1) Monitor/Projector power: Confirm device is ON and input source is correct (HDMI/VGA).",
      "2) Cable check: Reseat both ends of the video cable (PC ↔ Monitor/Projector).",
      "3) Display toggle (Windows): Press Win + P and try Duplicate or Extend.",
      "4) Brightness: Increase brightness or use monitor/projector menu to reset input.",
      NOTE,
    ]
  },
  {
    q: "Wi-Fi won’t connect", a: [
      "1) Airplane mode OFF: Check Windows quick settings.",
      "2) Forget & reconnect: Settings → Network & Internet → Wi-Fi → Manage networks → Forget, then reconnect with the correct password.",
      "3) Try another SSID if available for your room/role.",
      "4) Reboot PC. If others are also affected, it may be a local network issue.",
      NOTE,
    ]
  },
  {
    q: "No internet (connected but no access)", a: [
      "1) Test another site (e.g., example.com).",
      "2) Browser refresh / try another browser.",
      "3) Flush DNS quickly: Open Command Prompt → type ipconfig /flushdns → Enter.",
      "4) Reconnect Wi-Fi or replug LAN cable (click it in until it clicks).",
      NOTE,
    ]
  },
  {
    q: "PC is very slow or frozen", a: [
      "1) Close heavy apps/tabs you don’t need.",
      "2) Press Ctrl + Shift + Esc → Task Manager → End tasks that are Not Responding (only apps you opened).",
      "3) Restart the PC.",
      "4) Free disk space: Delete large downloads/temp files if you’re allowed.",
      NOTE,
    ]
  },
  {
    q: "No sound / audio problems", a: [
      "1) Volume: Unmute and raise volume (system & app).",
      "2) Output device: Click speaker icon → choose correct device (Speakers/Headphones/Projector).",
      "3) Cable check: Ensure 3.5mm jack or HDMI is fully inserted; power on external speakers.",
      "4) Test with another app (YouTube, local file).",
      NOTE,
    ]
  },
  {
    q: "Keyboard or mouse not working", a: [
      "1) Wired: Unplug and replug to a different USB port; avoid USB hubs if possible.",
      "2) Wireless: Ensure receiver is seated; replace/charge batteries; power toggle ON.",
      "3) Try another known-good keyboard/mouse if available.",
      NOTE,
    ]
  },
  {
    q: "Printer won’t print", a: [
      "1) Power & paper: Printer ON, paper loaded, no paper jam.",
      "2) Correct printer: In Printers & Scanners, set the correct device as default.",
      "3) Queue: Open print queue → cancel stuck jobs → print again.",
      "4) Connection: For network printers, ensure you’re on the right network; for USB, replug the cable.",
      NOTE,
    ]
  },
  {
    q: "Projector shows “No Signal”", a: [
      "1) Input source: Set projector to the correct HDMI/VGA input.",
      "2) Cable: Reseat the display cable at the PC and projector.",
      "3) Windows display: Press Win + P → select Duplicate.",
      "4) Wake screen: Move mouse/press a key to wake the PC.",
      NOTE,
    ]
  },
  {
    q: "Can’t access LMS/website", a: [
      "1) Confirm internet works on other sites.",
      "2) Try another browser / incognito window.",
      "3) Clear cache (Ctrl + Shift + Del → cached images/files).",
      "4) Check if the site has known downtime with colleagues.",
      NOTE,
    ]
  },
  {
    q: "App keeps crashing / won’t open", a: [
      "1) Close other apps and retry.",
      "2) Restart the PC.",
      "3) If the app needs sign-in, sign out/in again with the correct account.",
      "4) If it’s an installed lab app and still fails, report it for re-install.",
      NOTE,
    ]
  },
  {
    q: "Account / password problems", a: [
      "1) Verify CAPS LOCK and keyboard layout.",
      "2) If you recently changed your password, sign out and sign in again across apps.",
      "3) For locked/expired accounts, contact the MIS team via an IT Support Services report.",
      NOTE,
    ]
  },
];

const ChatBot = ({ embedded = false }) => {
  const [messages, setMessages] = useState([]);
  const [isReplying, setIsReplying] = useState(false);
  const endRef = useRef(null);

  // mobile tab
  const [mobileTab, setMobileTab] = useState("issues");

  // 🔹 custom presets from Firestore (admin-added)
  const [customQA, setCustomQA] = useState([]); // [{ q, a:[] }]

  // subscribe to presets in Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "chatbotPresets"), orderBy("createdAt", "desc")),
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data();
          return {
            q: data.question || "",
            a: Array.isArray(data.answers) ? data.answers : [],
          };
        });
        setCustomQA(rows);
      },
      (err) => {
        console.error("[ChatBot] presets subscribe error:", err);
        setCustomQA([]);
      }
    );
    return () => unsub();
  }, []);

  // merged list: DB first (editable by admins) then static defaults
  const mergedQA = useMemo(() => [...customQA, ...PRESET_QA], [customQA]);

  const questions = useMemo(() => mergedQA.map((x) => x.q), [mergedQA]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isReplying]);

  const handlePick = (q) => {
    if (isReplying) return;

    setMessages((prev) => [...prev, { from: "user", text: q }]);
    setIsReplying(true);

    const match = mergedQA.find((x) => x.q === q);
    const botText = (match?.a || ["Please select a valid question.", NOTE]).join("\n");

    setMobileTab("chat"); // switch to conversation on mobile

    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "bot", text: botText }]);
      setIsReplying(false);
    }, 320);
  };


  const clearChat = () => setMessages([]);

  return (
    <div className="h-full w-full flex flex-col">
      {/* Mobile tabs */}
      <div className="md:hidden border-b bg-white">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 rounded-full bg-pink-600 items-center justify-center text-white">
              <BotMessageSquare size={16} />
            </span>
            <span className="font-medium">IT HelpBot</span>
          </div>
          <button
            onClick={clearChat}
            className="text-sm px-3 py-1 rounded border hover:bg-gray-50"
          >
            Clear
          </button>
        </div>

        <div className="px-3 pb-2 flex gap-2">
          <button
            className={`px-3 py-1.5 rounded-full text-sm border ${mobileTab === "issues" ? "bg-gray-900 text-white border-gray-900" : "bg-white"
              }`}
            onClick={() => setMobileTab("issues")}
          >
            Common Issues
          </button>
          <button
            className={`px-3 py-1.5 rounded-full text-sm border ${mobileTab === "chat" ? "bg-gray-900 text-white border-gray-900" : "bg-white"
              }`}
            onClick={() => setMobileTab("chat")}
          >
            Conversation
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px,minmax(0,1fr)]">
        {/* Issues list */}
        <section className={`${mobileTab === "issues" ? "block" : "hidden"} md:block border-r bg-white min-h-0 overflow-y-auto`}>
          <div className="hidden md:flex items-center gap-2 px-4 py-3 border-b">
            <span className="inline-flex h-7 w-7 rounded-full bg-pink-600 items-center justify-center text-white">
              <BotMessageSquare size={16} />
            </span>
            <h2 className="font-semibold">Common Issues</h2>
          </div>

          <div className="p-3 md:p-4 grid grid-cols-1 gap-2">
            {questions.map((q) => (
              <button
                key={q}
                onClick={() => handlePick(q)}
                className="w-full text-left rounded-full border px-3 py-2 text-sm hover:bg-gray-50 active:bg-gray-100"
                title={q}
              >
                {q}
              </button>
            ))}
            <p className="text-[11px] text-gray-500 mt-2">
              For complex issues or if steps aren’t feasible in your room, submit a manual
              report under <span className="font-medium">IT Support Services</span>.
            </p>
          </div>
        </section>

        {/* Conversation */}
        <section className={`${mobileTab === "chat" ? "flex" : "hidden"} md:flex flex-col min-h-0 bg-gray-50`}>
          <div className="hidden md:flex items-center justify-between px-4 py-3 bg-white border-b">
            <h3 className="font-semibold">Conversation</h3>
            <button onClick={clearChat} className="text-sm px-3 py-1 rounded border hover:bg-gray-50">Clear</button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3">
            {messages.length === 0 && (
              <div className="max-w-2xl">
                <BotBubble>
                  Hi! Pick an issue on the left and I’ll guide you through safe, basic troubleshooting.{"\n"}
                  <span className="font-semibold">Reminder: Do NOT open the system unit.</span>
                </BotBubble>
              </div>
            )}

            <div className="max-w-2xl space-y-3">
              {messages.map((m, idx) =>
                m.from === "user" ? (
                  <UserBubble key={idx}>{m.text}</UserBubble>
                ) : (
                  <BotBubble key={idx}>{m.text}</BotBubble>
                )
              )}
              {isReplying && (
                <BotBubble>
                  <TypingDots />
                </BotBubble>
              )}
              <div ref={endRef} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const UserBubble = ({ children }) => (
  <div className="flex w-full justify-end">
    <div className="max-w-[85%] md:max-w-[70%] bg-[#0A1936] text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow">
      <div className="text-sm whitespace-pre-line">{children}</div>
    </div>
  </div>
);

const BotBubble = ({ children }) => (
  <div className="flex w-full justify-start items-start gap-3">
    <div className="h-9 w-9 rounded-full bg-pink-600 flex items-center justify-center text-white shrink-0">
      <BotMessageSquare size={18} aria-hidden="true" />
    </div>
    <div className="max-w-[85%] md:max-w-[70%] bg-white border rounded-2xl rounded-tl-sm px-4 py-3 shadow">
      <div className="text-sm whitespace-pre-line">{children}</div>
    </div>
  </div>
);

const TypingDots = () => (
  <div className="inline-flex gap-1 items-center">
    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.2s]" />
    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.1s]" />
    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
  </div>
);

export default ChatBot;
