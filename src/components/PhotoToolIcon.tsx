/** Consistent canvas icons. Buttons supply accessible names and tooltips. */
export function PhotoToolIcon({name}:{name:'move'|'wrap'|'pan'|'crop'}){
 return <svg className="photo-tool-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
  {name==='move'&&<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>}
  {name==='crop'&&<path d="M7 3v14h14M3 7h14v14M19 3l-4 4"/>}
  {name==='pan'&&<><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M12 6v12M6 12h12M10 8l2-2 2 2M10 16l2 2 2-2M8 10l-2 2 2 2M16 10l2 2-2 2"/></>}
  {name==='wrap'&&<><path d="M3 4h18M3 20h18M3 9h4M3 15h4M17 9h4M17 15h4M10 8l4 1 1 6-5 1z"/><circle cx="10" cy="8" r="1"/><circle cx="15" cy="15" r="1"/></>}
 </svg>;
}
