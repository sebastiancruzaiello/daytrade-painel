const base = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconeParar = () => <svg {...base}><rect x="3.5" y="3.5" width="9" height="9" rx="1.5" /></svg>;
export const IconePlay = () => <svg {...base}><path d="M5 3.5v9l7-4.5z" /></svg>;
export const IconePausa = () => <svg {...base}><path d="M5.5 3.5v9M10.5 3.5v9" /></svg>;
export const IconeCompra = () => <svg {...base}><path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" /></svg>;
export const IconeVenda = () => <svg {...base}><path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" /></svg>;
export const IconeFreio = () => <svg {...base}><path d="M8 2.5 14 13H2z" /><path d="M8 6.5v3M8 11.2v.1" /></svg>;
export const IconeRetomar = () => <svg {...base}><path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3.5 3v2.5H6" /></svg>;
export const IconeConta = () => <svg {...base}><rect x="2.5" y="3.5" width="11" height="9" rx="2" /><path d="M2.5 6.5h11" /></svg>;
