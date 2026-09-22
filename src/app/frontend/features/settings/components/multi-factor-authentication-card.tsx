import { type FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@frontend/lib/supabase";

type TotpFactor = {
  id: string;
  friendly_name?: string;
  status: "verified" | "unverified";
};
type Enrollment = { factorId: string; qrCode: string; secret: string };

export function MultiFactorAuthenticationCard() {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await supabase.auth.mfa.listFactors();
    if (result.error) setError(result.error.message);
    else setFactors(result.data.totp as TotpFactor[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function enroll() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "DroneSMS authenticator",
    });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    setEnrollment({
      factorId: result.data.id,
      qrCode: result.data.totp.qr_code,
      secret: result.data.totp.secret,
    });
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    const challenge = await supabase.auth.mfa.challenge({
      factorId: enrollment.factorId,
    });
    if (challenge.error) {
      setBusy(false);
      return setError(challenge.error.message);
    }
    const result = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    setEnrollment(null);
    setCode("");
    setMessage(
      "Multi-factor authentication is enabled. Store your authenticator recovery information securely.",
    );
    await load();
  }

  async function remove(factorId: string) {
    if (!window.confirm("Remove this authenticator factor?")) return;
    setBusy(true);
    setError(null);
    const result = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    setMessage("Authenticator factor removed.");
    await load();
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-brand-900">
        Multi-Factor Authentication
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Protect sign-in and ownership transfers with a time-based authenticator
        code.
      </p>
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {factors
          .filter((factor) => factor.status === "verified")
          .map((factor) => (
            <li
              className="flex items-center justify-between rounded-lg border bg-slate-50 p-3 text-sm"
              key={factor.id}
            >
              <span>
                {factor.friendly_name || "Authenticator app"} · Enabled
              </span>
              <button
                className="font-semibold text-red-700"
                disabled={busy}
                onClick={() => void remove(factor.id)}
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
      </ul>
      {!enrollment ? (
        <button
          className="mt-4 rounded-lg border border-brand-700 px-4 py-2 text-sm font-semibold text-brand-700 disabled:border-slate-300"
          disabled={busy}
          onClick={() => void enroll()}
          type="button"
        >
          Add Authenticator
        </button>
      ) : (
        <form
          className="mt-4 space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-4"
          onSubmit={verify}
        >
          <p className="text-sm">
            Scan this QR code with your authenticator app, then enter its
            six-digit code.
          </p>
          <img
            className="h-48 w-48 bg-white p-2"
            src={enrollment.qrCode}
            alt="Authenticator enrollment QR code"
          />
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold">
              Cannot scan the QR code?
            </summary>
            <code className="mt-2 block break-all rounded bg-white p-2">
              {enrollment.secret}
            </code>
          </details>
          <label className="block text-sm font-medium">
            Verification code
            <input
              className="mt-1 block rounded-lg border px-3 py-2"
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ""))
              }
              required
            />
          </label>
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
              disabled={busy || code.length !== 6}
            >
              Verify and Enable
            </button>
            <button
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
              type="button"
              onClick={() => setEnrollment(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
