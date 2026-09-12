"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@slidex/backend/api";
import type { Doc } from "@slidex/backend/data-model";
export function SlideEditor({ slide, report }: {slide:Doc<"slides">;report:(text:string)=>void}){
  const [title,setTitle]=useState(slide.title);const [body,setBody]=useState(slide.body);const [busy,setBusy]=useState(false);const [fresh,setFresh]=useState(false);
  const save=useMutation(api.live.saveSlide);
  return <details className="slide-editor"><summary>✎ Editar o crear slide</summary><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await save({presentationId:slide.presentationId,...(!fresh?{slideId:slide._id}:{}),title,body});report(fresh?"Slide creado":"Slide actualizado para toda la sala");}catch(error){report(String(error));}finally{setBusy(false);}}}><label className="editor-toggle"><input type="checkbox" checked={fresh} onChange={e=>{setFresh(e.target.checked);setTitle(e.target.checked?"":slide.title);setBody(e.target.checked?"":slide.body);}}/> Crear uno nuevo</label><label htmlFor="slide-title">Título</label><input id="slide-title" value={title} maxLength={100} required onChange={e=>setTitle(e.target.value)}/><label htmlFor="slide-body">Contenido</label><textarea id="slide-body" value={body} rows={4} maxLength={2000} onChange={e=>setBody(e.target.value)}/><button className="primary" disabled={busy || !title.trim()}>{busy?"Guardando…":fresh?"Crear slide":"Guardar en vivo"}</button></form></details>;
}
