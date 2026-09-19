/** The landing page is the admin workspace. The editor remains available at
 * #editor and shared documents continue to use their #edit=... links. */
export const isAdminHash = (hash: string) => hash === '' || hash === '#admin';
