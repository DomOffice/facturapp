"use client";

import { useRouter } from "next/navigation";

export default function RetourFacturesButton() {
  const router = useRouter();

  function retourFactures() {
    router.push("/factures");

    setTimeout(() => {
      router.refresh();
    }, 0);
  }

  return (
    <button
      type="button"
      onClick={retourFactures}
      className="btn-ghost btn-sm"
    >
      ← Retour
    </button>
  );
}