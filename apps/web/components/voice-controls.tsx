"use client";
import { tr, friendlyError, useTranslation, useLocale } from "../i18n/provider";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@slidex/backend/api";
import type { Doc, Id } from "@slidex/backend/data-model";

type Recognition = { lang:string; continuous:boolean; interimResults:boolean; onresult:((e:{resultIndex:number;results:{length:number;[n:number]:{isFinal:boolean;[n:number]:{transcript:string}}}})=>void)|null; onerror:((e:{error:string})=>void)|null; onend:(()=>void)|null; onstart:(()=>void)|null; start:()=>void; stop:()=>void; abort:()=>void };
export function VoiceControls({ room, slides, report, active = true }: { active?: boolean; room: Doc<"presentations">; slides: Doc<"slides">[]; report:(message:string)=>void }) {
  useTranslation();
  const locale = useLocale();
  const [listening,setListening]=useState(false);
  const [starting,setStarting]=useState(false);
  const [savingMode,setSavingMode]=useState(false);
  const startTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [supported,setSupported]=useState(false);
  const [transcript,setTranscript]=useState("");
  const [command,setCommand]=useState("");
  const [busy,setBusy]=useState(false);
  const recognition=useRef<Recognition|null>(null);
  const lastMoment=useRef(0);
  const settings=useMutation(api.live.settings);
  const moments=useMutation(api.moments.request);
  const navigate=useMutation(api.presentations.setCurrentSlide);
  const research=useMutation(api.research.request);
  const visual=useMutation(api.live.addVisual);
  const propose=useMutation(api.interventions.propose);
  const prepare=useMutation(api.interventions.prepare);
  const props=useRef({room,slides}); props.current={room,slides};
  useEffect(()=>{setSupported(!!((window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition));return()=>{ if(startTimer.current)clearTimeout(startTimer.current); recognition.current?.abort(); };},[]);
  useEffect(() => { if (!active) { recognition.current?.abort(); if (startTimer.current) clearTimeout(startTimer.current); setListening(false); setStarting(false); } }, [active]);
  const execute=async(text:string, manual=false)=>{
    const {room,slides}=props.current; const normalized=text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
    const index=slides.findIndex(s=>s._id===room.currentSlideId);
    const words=normalized.replace(/^slidex[,\s]*/,"").replace(/[.!?]+$/g,"");
    if(/^(siguiente|next)( slide| diapositiva)?$/.test(words) || /^(anterior|previous)( slide| diapositiva)?$/.test(words)){
      const next=slides[index+(/^(siguiente|next)/.test(words)?1:-1)];
      if(next)await navigate({presentationId:room._id,slideId:next._id});
      else report(tr("Ya estás en el extremo de la presentación"));
    } else if(/^(mostrar |muestra |abrir )?(el )?cierre$/.test(words) || /^(show )?takeaways$/.test(words)) await settings({presentationId:room._id,showConclusions:true});
    else if(/^(volver|volver al slide|back to slide)$/.test(words))await settings({presentationId:room._id,showConclusions:false});
    else if(/^(crear |muestra |mostrar )?(una )?constelacion$/.test(words) || /^(show )?constellation$/.test(words))await visual({presentationId:room._id,visual:"constellation",locale});
    else if(words==="pulso" || words==="mostrar pulso" || words==="pulse")await visual({presentationId:room._id,visual:"pulse",locale});
    else if((words === "explica mas facil" || words === "explain simply") || words.startsWith("plot twist ")) {
      if (!room.currentSlideId) return;
      const id = await propose({presentationId:room._id,slideId:room.currentSlideId,kind:(words === "explica mas facil" || words === "explain simply") ? "lost" : "twist",text:words.startsWith("plot twist ") ? text.replace(/^(slidex[,\s]*)?plot twist\s+/i, "").slice(0,300) : undefined});
      await prepare({id,locale}); report(tr("Preparando borrador. Revísalo en Cambia el rumbo antes de mostrarlo."));
    }
    else if(/^(investiga|crea un slide sobre|research|create a slide about)\s+/.test(words))await research({presentationId:room._id,locale,prompt:text.replace(/^(slidex[,\s]*)?(investiga|crea un slide sobre|research|create a slide about)\s+/i,"")});
    else if(room.voiceEnabled && (words.startsWith("meme ") || Date.now()-lastMoment.current>15000)){
      lastMoment.current=Date.now(); await moments({presentationId:room._id,locale,transcript:text.slice(0,1200),force:words.startsWith("meme ")});
    } else if(manual) report(words.startsWith("meme ") ? tr("Activa Momentos en vivo para buscar un meme contextual.") : tr("Comandos: siguiente, anterior, cierre, constelación, pulso o investiga…"));
  };
  const callback=useRef(execute);callback.current=execute;
  const toggle=()=>{
    if(listening || starting){setListening(false);setStarting(false);if(startTimer.current)clearTimeout(startTimer.current);recognition.current?.abort();return;}
    const Constructor=(window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if(!Constructor)return;
    const mic=new Constructor();mic.lang=locale === "en" ? "en-US" : "es-CO";mic.continuous=true;mic.interimResults=false;
    mic.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal){const text=e.results[i][0].transcript;setTranscript(text);void callback.current(text).catch(error=>report(friendlyError(error)));}}};
    mic.onstart=()=>{if(startTimer.current)clearTimeout(startTimer.current);setStarting(false);setListening(true);};
    mic.onerror=e=>{if(startTimer.current)clearTimeout(startTimer.current);setStarting(false);setListening(false);if(e.error==="aborted")return;report(e.error==="not-allowed"?tr("El micrófono está bloqueado. Permítelo en el navegador o usa el campo de comandos."):tr("Escucha detenida", { reason: e.error }));};
    mic.onend=()=>{if(startTimer.current)clearTimeout(startTimer.current);setStarting(false);setListening(false);};recognition.current=mic;
    try{setStarting(true);mic.start();startTimer.current=setTimeout(()=>{setStarting(false);setListening(false);mic.abort();report(tr("El navegador no inició la escucha. Revisa el permiso del micrófono o usa los comandos por texto."));},10000);}catch(error){setStarting(false);report(friendlyError(error));}
  };
  return <section className="voice-controls"><div className="voice-heading"><span>{tr("Tu voz, al mando")}</span><button aria-pressed={listening || starting} disabled={!supported} onClick={toggle}>{starting?tr("Cancelar inicio…"):listening?tr("■ Detener micrófono"):tr("♩ Activar micrófono")}</button></div><p>{supported?tr("Escucha solo al activarlo. El navegador procesa la voz; las frases de momentos se envían a OpenAI y Firecrawl."):tr("Este navegador no ofrece reconocimiento de voz. Usa los mismos comandos por texto o abre Chrome.")}</p><label className="moment-toggle"><input type="checkbox" checked={!!room.voiceEnabled} disabled={savingMode} onChange={async e=>{setSavingMode(true);try{await settings({presentationId:room._id,voiceEnabled:e.target.checked,clearMoment:!e.target.checked});}catch(error){report(friendlyError(error));}finally{setSavingMode(false);}}} /> {tr("Momentos en vivo · memes contextuales")}</label>{transcript && <blockquote aria-live="polite">“{transcript}”</blockquote>}<form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await execute(command,true);setTranscript(command);setCommand("");}catch(error){report(friendlyError(error));}finally{setBusy(false);}}}><label htmlFor="voice-command">{tr("Comando o frase de prueba")}</label><div className="command-row"><input id="voice-command" value={command} maxLength={1000} onChange={e=>setCommand(e.target.value)} placeholder={tr("siguiente · investiga… · meme…")}/><button disabled={busy || savingMode || !command.trim()}>{tr("Ejecutar")}</button></div></form><small>{tr("Di «siguiente», «anterior», «cierre», «constelación» «explica más fácil», «plot twist…» o «investiga…».")}</small></section>;
}
type SpeechWindow=Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};

export function MomentCard({ moment, presentationId, isHost }: { moment:NonNullable<Doc<"presentations">["moment"]>;presentationId:Id<"presentations">;isHost:boolean }) {
  useTranslation();
  const settings=useMutation(api.live.settings);
  const [imageFailed,setImageFailed]=useState(false);
  return <aside className="moment-card" aria-live="polite"><div><span>{tr("✦ EL SLIDE TE ESCUCHÓ")}</span>{isHost && <button aria-label={tr("Ocultar momento")} onClick={()=>void settings({presentationId,clearMoment:true})}>×</button>}</div>{moment.imageUrl && !imageFailed && <img src={moment.imageUrl} alt={tr("Meme relacionado con la frase del presentador")} referrerPolicy="no-referrer" onError={()=>setImageFailed(true)} />}<p>{moment.caption}</p>{moment.sourceUrl && <a href={moment.sourceUrl} target="_blank" rel="noreferrer">{tr("Ver fuente ↗")}</a>}</aside>;
}
