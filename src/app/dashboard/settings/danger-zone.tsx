"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  userEmail: string;
};

export function DangerZone({ userEmail }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmEmail, setConfirmEmail] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const emailMatches = confirmEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();

  React.useEffect(() => {
    if (!open) {
      setConfirmEmail("");
      setReason("");
      setError(null);
    }
  }, [open]);

  async function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!emailMatches || isDeleting) return;
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/user/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: userEmail, reason: reason.trim() || null }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Deletion failed (${response.status})`);
      }

      // Account deleted server-side. Force a full reload to clear all client state
      // (Supabase session cookies will fail their next refresh).
      window.location.href = "/?deleted=1";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setIsDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6">
      <h2 className="text-lg font-semibold text-red-300">Danger zone</h2>
      <p className="mt-2 text-sm text-gray-400">
        Delete your account and all associated revenue data. This action is{" "}
        <strong className="text-red-300">permanent</strong> and cannot be undone.
      </p>
      <ul className="mt-3 ml-5 list-disc space-y-1 text-sm text-gray-400">
        <li>All metrics, leak detections, and historical reports are erased</li>
        <li>Stripe Connect authorization is revoked (you can reconnect later)</li>
        <li>Any active billing subscription is canceled immediately</li>
        <li>A confirmation email is sent to {userEmail}</li>
      </ul>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="mt-5" type="button">
            Delete my account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your Corvidet account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your data, revokes Stripe Connect, and
              cancels any active billing subscription. Type your email below to
              confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5" htmlFor="confirm-email">
                Type <span className="font-mono text-gray-100">{userEmail}</span> to confirm
              </label>
              <input
                id="confirm-email"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                disabled={isDeleting}
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-red-500"
                placeholder={userEmail}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5" htmlFor="reason">
                Reason (optional, helps us improve)
              </label>
              <textarea
                id="reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isDeleting}
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-500"
              />
            </div>
            {error && (
              <p className="rounded-md border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} type="button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!emailMatches || isDeleting}
              className="bg-red-600 text-white shadow-sm hover:bg-red-500 disabled:bg-red-900/50 disabled:hover:bg-red-900/50"
              type="button"
            >
              {isDeleting ? "Deleting…" : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
