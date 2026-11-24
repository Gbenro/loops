// The build includes the installed Supabase realtime SDK; no second auth client is created.
declare const LunaRealtimeSDK: any;
export function createFieldRealtime(options: {
  url:string; apiKey:string;
  session:()=>{token:string|null;userId:string|null};
  changed:()=>void; Client?:any;
}) {
  const Client = options.Client || (typeof LunaRealtimeSDK !== 'undefined' ? LunaRealtimeSDK.RealtimeClient : null);
  let client:any=null, owner:string|null=null, token:string|null=null, epoch=0;
  let pending:ReturnType<typeof setTimeout>|undefined;
  function stop() {
    epoch++; clearTimeout(pending); pending=undefined;
    const old=client;client=null;owner=null;token=null;
    if(old){old.disconnect();void old.removeAllChannels().catch(()=>{});}
  }
  function start() {
    const session=options.session();
    if(!Client || !session.userId || !session.token){stop();return;}
    if(client && owner===session.userId){
      if(token!==session.token){token=session.token;void client.setAuth().catch(()=>{});}
      return;
    }
    stop();owner=session.userId;token=session.token;
    const current=epoch, currentOwner=owner;
    const notify=()=>{
      if(current!==epoch || options.session().userId!==currentOwner)return;
      clearTimeout(pending);
      pending=setTimeout(()=>{pending=undefined;if(current===epoch&&options.session().userId===currentOwner)options.changed();},200);
    };
    client=new Client(options.url+'/realtime/v1',{
      params:{apikey:options.apiKey},
      accessToken:async()=>options.session().userId===currentOwner?options.session().token:null
    });
    const channel=client.channel('beta-field-'+currentOwner);
    for(const table of ['echoes','loops','echo_reflections']){
      channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+currentOwner},notify);
    }
    channel.subscribe((status:string)=>{if(status==='SUBSCRIBED')notify();});
  }
  return {start,stop};
}
