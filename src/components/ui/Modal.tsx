"use client";

import { useEffect, type ReactNode } from "react";

type Props = {
  ouvert: boolean;
  titre: string;
  enfants: ReactNode;
  onFermer: () => void;
};

export default function Modal({
  ouvert,
  titre,
  enfants,
  onFermer,
}: Props) {
  useEffect(() => {
    if (!ouvert) return;

    const fermerAvecEchap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onFermer();
      }
    };

    document.addEventListener("keydown", fermerAvecEchap);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", fermerAvecEchap);
      document.body.style.overflow = "";
    };
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onFermer();
        }
      }}
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-slate-900"
          >
            {titre}
          </h2>

          <button
            type="button"
            onClick={onFermer}
            className="rounded-md px-3 py-1 text-2xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fermer la fenêtre"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {enfants}
        </div>
      </div>
    </div>
  );
}