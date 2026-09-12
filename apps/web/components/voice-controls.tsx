"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@slidex/backend/api";
import type { Doc, Id } from "@slidex/backend/data-model";

type Recognition = { lang:string; continuous:boolean; interimResults:boolean; onresult:((e:{resultIndex:number;results:{length:number;[n:number]:{isFinal:boolean;[n:number]:{transcript:string}}}})=>void)|null; onerror:((e:{error:string})=>void)|null; onend:(()=>void)|null; start:()=>void; stop:()=>void; abort:()=>void };
export function VoiceControls({ room, slides, report }: { room: Doc<"presentations">; slides: Doc<"slides">[]; report:(message:string)=>void }) {
  const [listening,setListening]=useState(false);
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
  const props=useRef({room,slides}); props.current={room,slides};
  useEffect(()=>{setSupported(!!((window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition));return()=>recognition.current?.abort();},[]);
  const execute=async(text:string)=>{
    const {room,slides}=props.current; const normalized=text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
    const index=slides.findIndex(s=>s._id===room.currentSlideId);
    const words=normalized.replace(/^slidex[,\s]*/,"").replace(/[.!?]+$/g,"");
    if(/^(siguiente|next)( slide| diapositiva)?$/.test(words) || /^(anterior|previous)( slide| diapositiva)?$/.test(words)){
      const next=slides[index+(/^(siguiente|next)/.test(words)?1:-1)];
      if(next)await navigate({presentationId:room._id,slideId:next._id});
      else report("Ya estás en el extremo de la presentación");
    } else if(/^(mostrar |muestra |abrir )?(el )?cierre$/.test(words)) await settings({presentationId:room._id,showConclusions:true});
    else if(/^(volver|volver al slide)$/.test(words))await settings({presentationId:room._id,showConclusions:false});
    else if(/^(crear |muestra |mostrar )?(una )?constelacion$/.test(words))await visual({presentationId:room._id,visual:"constellation"});
    else if(words==="pulso" || words==="mostrar pulso")await visual({presentationId:room._id,visual:"pulse"});
    else if(/^(investiga|crea un slide sobre)\s+/.test(words))await research({presentationId:room._id,prompt:text.replace(/^(slidex[,\s]*)?(investiga|crea un slide sobre)\s+/i,"")});
    else if(room.voiceEnabled && (words.startsWith("meme ") || Date.now()-lastMoment.current>15000)){
      lastMoment.current=Date.now(); await moments({presentationId:room._id,transcript:text.slice(0,1200),force:words.startsWith("meme ")});
    } else report("Comandos: siguiente, anterior, cierre, constelación, pulso o investiga…");
  };
  const callback=useRef(execute);callback.current=execute;
  const toggle=()=>{
    if(listening){recognition.current?.stop();setListening(false);return;}
    const Constructor=(window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if(!Constructor)return;
    const mic=new Constructor();mic.lang="es-CO";mic.continuous=true;mic.interimResults=false;
    mic.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal){const text=e.results[i][0].transcript;setTranscript(text);void callback.current(text).catch(error=>report(String(error)));}}};
    mic.onerror=e=>{setListening(false);report(e.error==="not-allowed"?"El micrófono está bloqueado. Permítelo en el navegador o usa el campo de comandos.":`La escucha se detuvo (${e.error}). Puedes usar el campo de comandos.`);};
    mic.onend=()=>setListening(false);recognition.current=mic;
    try{mic.start();setListening(true);}catch(error){report(String(error));}
  };
  return <section className="voice-controls"><div className="voice-heading"><span>Tu voz, al mando</span><button aria-pressed={listening} disabled={!supported} onClick={toggle}>{listening?"■ Detener micrófono":"♩ Activar micrófono"}</button></div><p>{supported?"Escucha solo al activarlo. El navegador procesa la voz; las frases de momentos se envían a OpenAI y Firecrawl.":"Este navegador no ofrece reconocimiento de voz. Usa los mismos comandos por texto o abre Chrome."}</p><label className="moment-toggle"><input type="checkbox" checked={!!room.voiceEnabled} onChange={e=>void settings({presentationId:room._id,voiceEnabled:e.target.checked,clearMoment:!e.target.checked}).catch(error=>report(String(error)))} /> Momentos en vivo · memes contextuales</label>{transcript && <blockquote aria-live="polite">“{transcript}”</blockquote>}<form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await execute(command);setTranscript(command);setCommand("");}catch(error){report(String(error));}finally{setBusy(false);}}}><label htmlFor="voice-command">Comando o frase de prueba</label><div className="command-row"><input id="voice-command" value={command} maxLength={1000} onChange={e=>setCommand(e.target.value)} placeholder="siguiente · investiga… · meme…"/><button disabled={busy || !command.trim()}>Ejecutar</button></div></form><small>Di «siguiente», «anterior», «cierre», «constelación» o «investiga…».</small></section>;
}
type SpeechWindow=Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};

export function MomentCard({ moment, presentationId, isHost }: { moment:NonNullable<Doc<"presentations">["moment"]>;presentationId:Id<"presentations">;isHost:boolean }) {
  const settings=useMutation(api.live.settings);
  const [imageFailed,setImageFailed]=useState(false);
  return <aside className="moment-card" aria-live="polite"><div><span>✦ EL SLIDE TE ESCUCHÓ</span>{isHost && <button aria-label="Ocultar momento" onClick={()=>void settings({presentationId,clearMoment:true})}>×</button>}</div>{moment.imageUrl && !imageFailed && <img src={moment.imageUrl} alt="Meme relacionado con la frase del presentador" referrerPolicy="no-referrer" onError={()=>setImageFailed(true)} />}<p>{moment.caption}</p>{moment.sourceUrl && <a href={moment.sourceUrl} target="_blank" rel="noreferrer">Ver fuente ↗</a>}</aside>;
}
