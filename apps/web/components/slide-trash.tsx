"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@slidex/backend/api";
import type { Doc, Id } from "@slidex/backend/data-model";
import { friendlyError } from "../i18n/provider";

export function SlideTrash({ presentationId, slide, count, report }: {presentationId:Id<"presentations">;slide:Doc<"slides">;count:number;report:(message:string)=>void}) {
  const [confirm,setConfirm]=useState(false),[open,setOpen]=useState(false),[busy,setBusy]=useState(false);
  const cancel=useRef<HTMLButtonElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const remove=useMutation(api.slideTrash.remove),restore=useMutation(api.slideTrash.restore);
  const archived=useQuery(api.slideTrash.list,open?{presentationId}:"skip");
  useEffect(()=>{setConfirm(false);},[slide._id]);
  useEffect(()=>{if(confirm)cancel.current?.focus();},[confirm]);
  const dismiss=()=>{setConfirm(false);trigger.current?.focus();};
  return <div className="slide-trash"><button ref={trigger} type="button" title="Eliminar esta diapositiva" disabled={count<=1 || busy} onClick={()=>{setConfirm(true);setOpen(false);}}>⌫ Eliminar slide</button><button type="button" aria-expanded={open} onClick={()=>{setOpen(!open);setConfirm(false);}}>Archivadas</button>
    {confirm && <div className="slide-trash-popover" role="dialog" aria-label="Confirmar eliminación de diapositiva" onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();dismiss();}}}><strong>¿Eliminar «{slide.title}»?</strong><p>Sale de la presentación para todos. Puedes recuperarla desde Archivadas.</p><div><button ref={cancel} disabled={busy} onClick={dismiss}>Cancelar</button><button className="danger" disabled={busy} onClick={async()=>{setBusy(true);try{await remove({presentationId,slideId:slide._id});setConfirm(false);report("Diapositiva retirada. Puedes recuperarla desde Archivadas.");}catch(error){report(friendlyError(error));}finally{setBusy(false);}}}>{busy?"Eliminando…":"Eliminar diapositiva"}</button></div></div>}
    {open && <div className="slide-trash-popover" role="region" aria-label="Diapositivas archivadas"><header><strong>Diapositivas archivadas</strong><button aria-label="Cerrar archivadas" onClick={()=>setOpen(false)}>×</button></header>{archived===undefined?<p>Cargando…</p>:!archived.length?<p>No hay diapositivas archivadas.</p>:archived.map(item=><div className="slide-trash-row" key={item._id}><span>{item.title}</span><button disabled={busy || count>=50} onClick={async()=>{setBusy(true);try{await restore({presentationId,slideId:item._id});report("Diapositiva restaurada al final de la presentación.");}catch(error){report(friendlyError(error));}finally{setBusy(false);}}}>Restaurar</button></div>)}</div>}
  </div>;
}
