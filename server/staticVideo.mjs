import {createReadStream} from 'node:fs';

/** Same-origin background clips, including Safari's initial byte-range probe.
 * Stream only the requested bytes; never change API/private-file caching. */
export function serveVideo(req,res,file,size){
  res.setHeader('Content-Type','video/mp4');res.setHeader('Accept-Ranges','bytes');
  let start=0,end=size-1,status=200;
  if(req.method==='GET'&&req.headers.range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(!match||(!match[1]&&!match[2]))return unsatisfied(res,size);
    if(!match[1]){
      const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return unsatisfied(res,size);
      start=Math.max(0,size-suffix);
    }else{
      start=Number(match[1]);end=match[2]?Number(match[2]):size-1;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end))return unsatisfied(res,size);
    }
    if(start<0||start>=size||end<start)return unsatisfied(res,size);
    end=Math.min(end,size-1);status=206;
    res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);
  }
  res.setHeader('Content-Length',String(Math.max(0,end-start+1)));res.writeHead(status);
  if(req.method==='HEAD'||size===0)return res.end();
  const stream=createReadStream(file,{start,end});
  stream.once('error',()=>res.destroy());res.once('close',()=>stream.destroy());stream.pipe(res);
}
function unsatisfied(res,size){res.writeHead(416,{'Content-Range':`bytes */${size}`,'Content-Length':'0'});res.end();}
