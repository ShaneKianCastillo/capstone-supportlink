import React, { useEffect, useMemo, useRef, useState } from "react";
import { BotMessageSquare } from "lucide-react";


/**
 * Basic IT Troubleshooting ChatBot
 * - Predefined questions only (no free text)
 * - Instructors must NOT open system units
 * - Every bot answer ends with a NOTE directing to "IT Support Services" report if needed
 * - TailwindCSS UI, responsive
 */

const NOTE =
  "NOTE: If any step is not possible in your room (or the issue persists), please submit a manual report and choose the service type “IT Support Services.” Do NOT open the system unit.";

const PRESET_QA = [
  {
    q: "PC won’t turn on",
    a: [
      "1) Check power: Ensure the AVR/extension and wall outlet switches are ON.",
      "2) Cables: Firmly reseat the PC power cable and monitor power cable.",
      "3) Power button: Hold for 5 seconds, then press once to start.",
      "4) Power indicators: If no lights/fans at all, move the plug to a known working outlet/AVR port.",
      NOTE,
    ],
  },
  {
    q: "No display on monitor/projector",
    a: [
      "1) Monitor/Projector power: Confirm device is ON and input source is correct (HDMI/VGA).",
      "2) Cable check: Reseat both ends of the video cable (PC ↔ Monitor/Projector).",
      "3) Display toggle (Windows): Press **Win + P** and try **Duplicate** or **Extend**.",
      "4) Brightness: Increase brightness or use monitor/projector menu to reset input.",
      NOTE,
    ],
  },
  {
    q: "Wi-Fi won’t connect",
    a: [
      "1) Airplane mode OFF: Check Windows quick settings.",
      "2) Forget & reconnect: Settings → Network & Internet → Wi-Fi → Manage networks → Forget, then reconnect with the correct password.",
      "3) Try another SSID if available for your room/role.",
      "4) Reboot PC. If others are also affected, it may be a local network issue.",
      NOTE,
    ],
  },
  {
    q: "No internet (connected but no access)",
    a: [
      "1) Test another site (e.g., example.com).",
      "2) Browser refresh / try another browser.",
      "3) Flush DNS quickly: Open **Command Prompt** → type `ipconfig /flushdns` → Enter.",
      "4) Reconnect Wi-Fi or replug LAN cable (click it in until it clicks).",
      NOTE,
    ],
  },
  {
    q: "PC is very slow or frozen",
    a: [
      "1) Close heavy apps/tabs you don’t need.",
      "2) Press **Ctrl + Shift + Esc** → Task Manager → End tasks that are Not Responding (only apps you opened).",
      "3) Restart the PC.",
      "4) Free disk space: Delete large downloads/temp files if you’re allowed.",
      NOTE,
    ],
  },
  {
    q: "No sound / audio problems",
    a: [
      "1) Volume: Unmute and raise volume (system & app).",
      "2) Output device: Click speaker icon → choose correct device (Speakers/Headphones/Projector).",
      "3) Cable check: Ensure 3.5mm jack or HDMI is fully inserted; power on external speakers.",
      "4) Test with another app (YouTube, local file).",
      NOTE,
    ],
  },
  {
    q: "Keyboard or mouse not working",
    a: [
      "1) Wired: Unplug and replug to a different USB port; avoid USB hubs if possible.",
      "2) Wireless: Ensure receiver is seated; replace/charge batteries; power toggle ON.",
      "3) Try another known-good keyboard/mouse if available.",
      NOTE,
    ],
  },
  {
    q: "Printer won’t print",
    a: [
      "1) Power & paper: Printer ON, paper loaded, no paper jam.",
      "2) Correct printer: In **Printers & Scanners**, set the correct device as default.",
      "3) Queue: Open print queue → cancel stuck jobs → print again.",
      "4) Connection: For network printers, ensure you’re on the right network; for USB, replug the cable.",
      NOTE,
    ],
  },
  {
    q: "Projector shows “No Signal”",
    a: [
      "1) Input source: Set projector to the correct HDMI/VGA input.",
      "2) Cable: Reseat the display cable at the PC and projector.",
      "3) Windows display: Press **Win + P** → select **Duplicate**.",
      "4) Wake screen: Move mouse/press a key to wake the PC.",
      NOTE,
    ],
  },
  {
    q: "Can’t access LMS/website",
    a: [
      "1) Confirm internet works on other sites.",
      "2) Try another browser / incognito window.",
      "3) Clear cache (Ctrl + Shift + Del → cached images/files).",
      "4) Check if the site has known downtime with colleagues.",
      NOTE,
    ],
  },
  {
    q: "App keeps crashing / won’t open",
    a: [
      "1) Close other apps and retry.",
      "2) Restart the PC.",
      "3) If the app needs sign-in, sign out/in again with the correct account.",
      "4) If it’s an installed lab app and still fails, report it for re-install.",
      NOTE,
    ],
  },
  {
    q: "Account / password problems",
    a: [
      "1) Verify CAPS LOCK and keyboard layout.",
      "2) If you recently changed your password, sign out and sign in again across apps.",
      "3) For locked/expired accounts, contact the MIS team via an **IT Support Services** report.",
      NOTE,
    ],
  },
];

const ChatBot = () => {
  const [messages, setMessages] = useState([]);
  const [isReplying, setIsReplying] = useState(false);
  const endRef = useRef(null);

  const questions = useMemo(() => PRESET_QA.map((x) => x.q), []);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isReplying]);

  const handlePick = (q) => {
    if (isReplying) return;

    // user bubble
    setMessages((prev) => [...prev, { from: "user", text: q }]);
    setIsReplying(true);

    // bot response after a short delay
    const match = PRESET_QA.find((x) => x.q === q);
    const botText =
      (match?.a || ["Please select a valid question.", NOTE]).join("\n");

    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "bot", text: botText }]);
      setIsReplying(false);
    }, 350);
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A1936] text-white px-4 py-3 flex items-center justify-between shadow">
        <h1 className="text-lg sm:text-xl font-semibold">
          IT Self-Help Assistant
        </h1>
        <button
          onClick={clearChat}
          className="text-sm bg-white/10 hover:bg-white/20 rounded px-3 py-1"
        >
          Clear
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-3 sm:px-6 py-4">
        {/* Intro bubble */}
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto mb-4">
            <BotBubble>
              Hi! Pick a common issue below and I’ll guide you through safe,
              basic troubleshooting. <br />
              <span className="font-semibold">
                Reminder: Do NOT open the system unit.
              </span>
            </BotBubble>
          </div>
        )}

        <div className="max-w-2xl mx-auto space-y-3">
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

      {/* Picker */}
      <div className="border-t bg-white">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3">
          <p className="text-sm font-semibold mb-2">Select a common issue:</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((q) => (
              <button
                key={q}
                onClick={() => handlePick(q)}
                disabled={isReplying}
                className={`text-sm rounded-full px-3 py-2 border
                            ${isReplying ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-100"}
                           `}
                title={q}
              >
                {q}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-600 mt-3">
            For complex issues or if steps aren’t feasible in your room, submit
            a manual report under <span className="font-semibold">IT Support Services</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

const UserBubble = ({ children }) => (
  <div className="flex w-full justify-end">
    <div className="max-w-[85%] sm:max-w-[70%] bg-[#0A1936] text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow">
      <div className="text-sm whitespace-pre-line">{children}</div>
    </div>
  </div>
);

const BotBubble = ({ children }) => (
  <div className="flex w-full justify-start items-start gap-3">
    {/* Bot avatar */}
    <div className="h-9 w-9 rounded-full bg-pink-600 flex items-center justify-center text-white shrink-0">
      <BotMessageSquare size={18} aria-hidden="true" />
    </div>

    {/* Message bubble */}
    <div className="max-w-[85%] sm:max-w-[70%] bg-white border rounded-2xl rounded-tl-sm px-4 py-3 shadow">
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
