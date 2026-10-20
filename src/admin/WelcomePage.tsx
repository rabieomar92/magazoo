import {useEffect,useRef,type ReactNode} from 'react';
import {LoginBackground} from './LoginBackground';
import './welcome.css';

function Arrow(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>;}
function OriginalLogo(){return <img className="welcome-original-logo" src={`${import.meta.env.BASE_URL}magazoo-mark.png`} alt="Magazoo!"/>;}

/** Static previews rendered from the saved article snapshot; raw JSON and
 * private links never ship with the public welcome page. */
function EditorialArtwork(){return <div className="welcome-art welcome-art--real">
 <div className="welcome-art-label"><span>CREATED IN MAGAZOO</span><span>ARTICLE SAMPLES</span></div>
 <div className="welcome-real-spread">{['When Classical Meets Quantum','AI Takes on the Typhoon'].map((title,index)=><img key={title} src={`${import.meta.env.BASE_URL}samples/article-page-${index+1}.webp`} alt={`Saved article sample: ${title}`} width={688} height={975} decoding="async"/>)}</div>
 <div className="welcome-art-foot"><span>Real articles. Designed in Magazoo.</span><span>01 — 02</span></div>
 </div>;}

export function WelcomePage({onLogin,signedIn=false,children}:{onLogin:()=>void;signedIn?:boolean;children?:ReactNode}){
 return <main className="welcome-page">
  <section className="welcome-hero"><div className="welcome-intro"><LoginBackground/><a className="welcome-hero-logo" href={import.meta.env.BASE_URL} aria-label="Magazoo home"><OriginalLogo/></a><p className="welcome-eyebrow">MAGAZINE EDITING &amp; PUBLISHING</p><h1>Ideas,<br/><span>in print.</span></h1><p className="welcome-lede">Magazoo is a workspace for creating magazines—from individual articles to a complete issue.</p><p className="welcome-description">Edit text and photos on the page, arrange your articles, and export PDFs for print or online reading. Keep the content, design and page order together in one place.</p><div className="welcome-actions"><button className="welcome-cta" onClick={onLogin}>{signedIn?'Open workspace':'Editor login'}<Arrow/></button><a className="welcome-try" href={`${import.meta.env.BASE_URL}#editor`}>Try Magazoo Editor<Arrow/></a></div></div><EditorialArtwork/></section>
  <footer className="welcome-footer"><span>Magazoo is developed by M. R. Omar, a researcher at the USM School of Physics, to simplify magazine editing, design and publishing.</span></footer>
  {children}
 </main>;
}

export function EditorLoginDialog({children,close,busy}:{children:ReactNode;close:()=>void;busy:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();dialog?.querySelector<HTMLInputElement>('input')?.focus();return()=>dialog?.close();},[]);
 return <dialog ref={ref} className="welcome-login-dialog" aria-labelledby="admin-login-title" onCancel={event=>{event.preventDefault();if(!busy)close();}}>
  <button className="welcome-dialog-close" aria-label="Close editor login" disabled={busy} onClick={close}>×</button><OriginalLogo/>
  <h2 id="admin-login-title">Editor login</h2><p className="welcome-dialog-description">Sign in to the Magazoo workspace.</p>{children}
 </dialog>;
}
