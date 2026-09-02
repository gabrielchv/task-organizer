"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarIcon, ClipboardIcon, CopyIcon, ShareIcon } from "@/components/icons";
import type { Dictionary } from "@/i18n";
import { WakeWordToggle } from "./TaskActions";

const SCREEN_MARGIN_PX = 10;

interface OptionsMenuProps {
  isOpen: boolean;
  anchor: { top: number; right: number } | null;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  dictionary: Dictionary;
  isSignedIn: boolean;
  canShare: boolean;
  isWakeWordEnabled: boolean;
  isWakeWordLoading: boolean;
  onToggleWakeWord: () => void;
  onShare: () => void;
  onCopy: () => void;
  onExportTasks: () => void;
  onExportCalendar: () => void;
}

function MenuItem({
  onClick,
  label,
  icon,
  tone = "text-gray-700",
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50 active:bg-gray-100 ${tone}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

export function OptionsMenu({
  isOpen,
  anchor,
  onClose,
  triggerRef,
  dictionary,
  isSignedIn,
  canShare,
  onShare,
  onCopy,
  onExportTasks,
  onExportCalendar,
  ...wakeWord
}: OptionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  // Measured and written straight to the node before paint, so the menu never
  // appears off-screen for a frame and no extra render is scheduled.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!isOpen || !anchor || !menu) return;

    const width = menu.getBoundingClientRect().width;
    const overflowsLeft = window.innerWidth - anchor.right - width < SCREEN_MARGIN_PX;
    const right = overflowsLeft
      ? window.innerWidth - width - SCREEN_MARGIN_PX
      : Math.max(anchor.right, SCREEN_MARGIN_PX);

    menu.style.right = `${right}px`;
  }, [isOpen, anchor]);

  if (!isOpen || !anchor || typeof document === "undefined") return null;

  const close = (action: () => void) => () => {
    action();
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={dictionary.toolsAndSettings}
      className="fixed z-50 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white py-2 shadow-2xl"
      style={{ top: anchor.top, right: anchor.right }}
    >
      <div className="border-b border-gray-100 px-2 pb-2">
        <WakeWordToggle
          dictionary={dictionary}
          {...wakeWord}
          onToggleWakeWord={close(wakeWord.onToggleWakeWord)}
        />
      </div>

      {canShare && (
        <MenuItem
          onClick={close(onShare)}
          label={dictionary.share}
          icon={<ShareIcon className="h-4 w-4 text-gray-600" />}
        />
      )}
      <MenuItem
        onClick={close(onCopy)}
        label={dictionary.copy}
        icon={<CopyIcon className="h-4 w-4 text-gray-600" />}
      />
      {isSignedIn && (
        <>
          <MenuItem
            onClick={close(onExportTasks)}
            label={dictionary.export}
            tone="text-blue-600"
            icon={<ClipboardIcon className="h-4 w-4 text-blue-600" />}
          />
          <MenuItem
            onClick={close(onExportCalendar)}
            label={dictionary.exportCalendar}
            tone="text-blue-600"
            icon={<CalendarIcon className="h-4 w-4 text-blue-600" />}
          />
        </>
      )}
    </div>,
    document.body,
  );
}
