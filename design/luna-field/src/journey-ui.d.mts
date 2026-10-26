import type { LunaServices } from './contracts.ts';
export function mountJourney(host:Element|null,services:LunaServices):{owner:string|undefined;pause():void;refresh():void;dispose():void};
