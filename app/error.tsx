"use client";

import { AlertCircle } from "lucide-react";
import { BRAND } from "@/lib/config";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  const details = error.message.trim();

  return (
    <main
      className="min-h-screen px-6 py-16 md:px-8"
      style={{ backgroundColor: BRAND.colors.pageBackground }}
    >
      <div className="mx-auto max-w-3xl">
        <div
          className="rounded-[24px] border bg-white p-8 md:p-10"
          style={{ borderColor: BRAND.colors.borderSubtle, boxShadow: `0 12px 32px ${BRAND.colors.shadowMedium}` }}
        >
          <div className="flex items-start gap-4">
            <span
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: BRAND.colors.alertCriticalBackground, color: BRAND.colors.alertCritical }}
              aria-hidden
            >
              <AlertCircle className="h-6 w-6" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p
                className="text-sm font-semibold uppercase tracking-[0.12em]"
                style={{ color: BRAND.colors.alertCritical }}
              >
                Loading error
              </p>
              <h1 className="mt-2 text-3xl font-bold leading-tight" style={{ color: BRAND.colors.textStrong }}>
                The dashboard could not be loaded.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7" style={{ color: BRAND.colors.textMuted }}>
                There was a problem preparing the dashboard. Try again, and if it keeps happening, check the logs for
                the technical details.
              </p>
              {details ? (
                <p
                  className="mt-4 rounded-[14px] border px-4 py-3 text-sm leading-6"
                  style={{
                    borderColor: BRAND.colors.borderSubtle,
                    backgroundColor: BRAND.colors.pageBackground,
                    color: BRAND.colors.textBody
                  }}
                >
                  {details}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => reset()}
                className="mt-6 inline-flex items-center rounded-[12px] bg-black px-5 py-3 font-semibold text-white transition-opacity hover:opacity-85"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
