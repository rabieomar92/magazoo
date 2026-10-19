/** Validate embedded backup data before it can replace a working arrangement. */
export function decodeIssuePdf(src:unknown):Uint8Array {
 const recovery='The arrangement contains an incomplete or damaged embedded PDF. Restore a complete backup or reimport the original PDF; the arrangement has not been changed.';
 if(typeof src!=='string'||!/^data:application\/pdf;base64,/i.test(src))throw new Error(recovery);
 const encoded=src.slice(src.indexOf(',')+1).replace(/\s/g,'');
 if(encoded.length>12*1024*1024||encoded.length%4===1||!encoded||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new Error(recovery);
 let decoded:string;
 try{decoded=atob(encoded);}catch{throw new Error(recovery);}
 if(!decoded.startsWith('%PDF-')||decoded.length>8*1024*1024)throw new Error(recovery);
 return Uint8Array.from(decoded,character=>character.charCodeAt(0));
}
