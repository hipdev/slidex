"use client";
import { tr, friendlyError, useTranslation, useLocale } from "../i18n/provider";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@slidex/backend/api";
import type { Doc } from "@slidex/backend/data-model";
export function SlideEditor({ slide, report }: {slide:Doc<"slides">;report:(text:string)=>void}){
  useTranslation();
  const [title,setTitle]=useState(slide.title);const [body,setBody]=useState(slide.body);const [busy,setBusy]=useState(false);const [fresh,setFresh]=useState(false);
  const save=useMutation(api.live.saveSlide);
  return <details className="slide-editor"><summary>{tr("✎ Editar o crear slide")}</summary><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await save({presentationId:slide.presentationId,...(!fresh?{slideId:slide._id}:{}),title,body});report(fresh?tr("Slide creado"):tr("Slide actualizado para toda la sala"));}catch(error){report(friendlyError(error));}finally{setBusy(false);}}}><label className="editor-toggle"><input type="checkbox" checked={fresh} onChange={e=>{setFresh(e.target.checked);setTitle(e.target.checked?"":slide.title);setBody(e.target.checked?"":slide.body);}}/> {tr("Crear uno nuevo")}</label><label htmlFor="slide-title">{tr("Título")}</label><input id="slide-title" value={title} maxLength={100} required onChange={e=>setTitle(e.target.value)}/><label htmlFor="slide-body">{tr("Contenido")}</label><textarea id="slide-body" value={body} rows={4} maxLength={2000} onChange={e=>setBody(e.target.value)}/><button className="primary" disabled={busy || !title.trim()}>{busy?tr("Guardando…"):fresh?tr("Crear slide"):tr("Guardar en vivo")}</button></form></details>;
}
