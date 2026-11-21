"use client";

import { OTPInput, REGEXP_ONLY_DIGITS } from "input-otp";
import { tr } from "../i18n/provider";

// Adapted from Tranky's single accessible input and six visual slots. Keeping
// one real input preserves paste, mobile autofill and password-manager behavior.
export function OtpCodeInput({ value, onChange, disabled, invalid }: {
  value: string; onChange: (code: string) => void;
  disabled: boolean; invalid: boolean;
}) {
  return <OTPInput
    aria-label={tr("Código de 6 dígitos")} aria-invalid={invalid} aria-describedby={invalid ? "otp-helper otp-error" : "otp-helper"}
    maxLength={6} value={value} onChange={onChange}
    autoFocus spellCheck={false} disabled={disabled} inputMode="numeric" autoComplete="one-time-code"
    pattern={REGEXP_ONLY_DIGITS} pushPasswordManagerStrategy="none" containerClassName="otp-input"
    render={({ slots }) => <div className="otp-slots" aria-hidden="true">{slots.map((slot, index) =>
      <span key={index} className={`otp-slot ${slot.isActive ? "active" : ""} ${slot.char ? "filled" : ""} ${invalid ? "invalid" : ""}`}>
        {slot.char ?? (slot.hasFakeCaret ? <span className="otp-caret" /> : "")}
      </span>,
    )}</div>}
  />;
}
