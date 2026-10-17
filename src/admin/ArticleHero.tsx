import { useState } from 'react';
import { AdminIcon } from './AdminIcon';
import type { LibraryItem } from './libraryModel';

/** Loads only the visible card's image through the authenticated admin route. */
export function ArticleHero({item, href}: {item:LibraryItem; href:string}) {
  const [status,setStatus] = useState<'loading'|'ready'|'empty'>('loading');
  return <a className={`admin-article-hero is-${status}`} href={href} target="_blank" rel="noreferrer" aria-label={`Open ${item.name} from its image preview`}>
    {status !== 'empty' && <img src={`${import.meta.env.BASE_URL}api/documents/${encodeURIComponent(item.id)}/hero?v=${item.version}&thumbnail=1`} alt="" width={600} height={240} loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onLoad={event=>setStatus(event.currentTarget.naturalWidth > 0 ? 'ready' : 'empty')}
      onError={()=>setStatus('empty')}/>}
    {status !== 'ready' && <span className="admin-hero-placeholder"><AdminIcon name="article"/><span>{status === 'empty' ? 'No hero image' : 'Article preview'}</span></span>}
  </a>;
}
