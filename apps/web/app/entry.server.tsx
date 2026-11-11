// site-runtime's React Router server entry, the same on every site: the nonce on React's and React Router's scripts
// and, through ./nonce's NonceContext, every script the root Layout renders; the whole page for a crawler; a render
// error logged once. Its presence tells React Router the runtime is not Node.
export { default, handleError, streamTimeout } from "@dustinedwards/site-runtime/react-entry";
