"use client";

import { useId, useState } from "react";
import { tr } from "../i18n/provider";

export function RoomJoinForm() {
  const [code, setCode] = useState("");
  const id = useId();
  return <form className="room-rejoin-form" onSubmit={event => {
    event.preventDefault();
    window.location.assign(`/?r=${encodeURIComponent(code.trim().toUpperCase())}`);
  }}>
    <label htmlFor={id}>{tr("Entrar a otra sala")}</label>
    <p id={`${id}-hint`}>{tr("Escribe el código que compartió el presentador.")}</p>
    <div><input id={id} aria-describedby={`${id}-hint`} required pattern="(LIVE-)?[A-Z0-9]{4,5}" maxLength={10} value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="RF2R" autoCapitalize="characters" autoComplete="off" spellCheck={false} enterKeyHint="go" /><button type="submit" disabled={!code.trim()}>{tr("Unirme →")}</button></div>
  </form>;
}
