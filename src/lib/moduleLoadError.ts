export function moduleLoadErrorMessage(message:string){
 return /Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading chunk .* failed/i.test(message)
  ? 'This tab is using an older application version. Save any open edits, refresh Magazoo, then compile again. Your saved articles and arrangement have not been removed.'
  : message;
}
