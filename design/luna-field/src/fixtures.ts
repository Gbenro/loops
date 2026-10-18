import { AUDIO_FIXTURES } from './audio-fixtures.ts';
import type { FieldSnapshot, Phase, PhaseId, LunarContext } from './contracts.ts';

export const PHASES: Phase[] = [
  {id:'new',name:'New Moon',shortName:'New',index:0,light:0.08,fixtureDate:'October 1'},
  {id:'waxing-crescent',name:'Waxing Crescent',shortName:'Waxing crescent',index:1,light:0.23,fixtureDate:'October 5'},
  {id:'first-quarter',name:'First Quarter',shortName:'First quarter',index:2,light:0.46,fixtureDate:'October 9'},
  {id:'waxing-gibbous',name:'Waxing Gibbous',shortName:'Waxing gibbous',index:3,light:0.7,fixtureDate:'October 13'},
  {id:'full',name:'Full Moon',shortName:'Full',index:4,light:0.95,fixtureDate:'October 17'},
  {id:'waning-gibbous',name:'Waning Gibbous',shortName:'Waning gibbous',index:5,light:0.7,fixtureDate:'October 21'},
  {id:'last-quarter',name:'Last Quarter',shortName:'Last quarter',index:6,light:0.46,fixtureDate:'October 25'},
  {id:'waning-crescent',name:'Waning Crescent',shortName:'Waning crescent',index:7,light:0.23,fixtureDate:'October 28'},
];
// These deliberately illustrative dates are never advertised as a live lunar calendar.
export const DEMO_CONTEXT: LunarContext = {cycleId:'cycle-10',phaseId:'first-quarter',label:'First Quarter',source:'fixture'};
const context = (phaseId:PhaseId,cycleId='cycle-10'):LunarContext => ({cycleId,phaseId,label:PHASES.find(p=>p.id===phaseId)!.name,source:'fixture'});
export const FIXTURES: FieldSnapshot = {
  current: DEMO_CONTEXT,
  cycles:[{id:'cycle-10',name:'The October field',world:'ocean',range:'October 1 — 29 · illustrative dates',phases:PHASES},{id:'cycle-09',name:'The September field',world:'ocean',range:'September 2 — 30 · illustrative dates',phases:PHASES}],
  echoes:[
    {id:'echo-water',title:'A little room between things',body:'I took the longer way home beside the water. For a few minutes, I left my headphones in my pocket. There was nothing in particular to figure out. I noticed how different the same walk felt when I was not trying to get somewhere.',occurredAt:'2026-10-09T18:42:00-05:00',kind:'voice',audioKey:'water',duration:AUDIO_FIXTURES.water.duration,waveform:AUDIO_FIXTURES.water.waveform,waveformSource:'decoded-audio',context:context('first-quarter'),threadIds:['thread-space'],provenance:'synthetic'},
    {id:'echo-table',title:'The table by the window',body:'I moved my sketchbook to the small table by the window. It has been sitting in a drawer for months. I drew the outline of a cup while the kettle warmed. I would like to leave it there for a while.',occurredAt:'2026-10-08T08:14:00-05:00',kind:'text',context:context('waxing-crescent'),threadIds:['thread-making'],provenance:'synthetic'},
    {id:'echo-question',title:'A question worth keeping',body:'Can I make room for an idea before I know where it is going? I keep noticing the urge to explain it too soon. For now I want to write down what catches my attention and see what I return to.',occurredAt:'2026-10-05T21:06:00-05:00',kind:'voice',audioKey:'question',duration:AUDIO_FIXTURES.question.duration,waveform:AUDIO_FIXTURES.question.waveform,waveformSource:'decoded-audio',context:context('waxing-crescent'),threadIds:['thread-making','thread-space'],provenance:'synthetic'},
    {id:'echo-call',title:'An unhurried conversation',body:'We spoke for nearly an hour. There was a long pause and neither of us rushed to fill it. I want to remember that part of the conversation as much as the things we said.',occurredAt:'2026-10-02T19:32:00-05:00',kind:'text',context:context('new'),threadIds:['thread-space'],provenance:'synthetic'},
    {id:'echo-return',title:'The same path, another evening',body:'I walked beside the water after a busy day. I spent most of the walk making a list in my head. Just before turning home, I noticed the light on the surface and stopped for a moment.',occurredAt:'2026-09-10T18:20:00-05:00',kind:'text',context:context('first-quarter','cycle-09'),threadIds:['thread-space'],provenance:'synthetic'},
    {id:'echo-first',title:'Leaving a page open',body:'I opened a new sketchbook today. I did not make a plan for what belongs in it. I wrote the date in the corner and left the rest of the page open.',occurredAt:'2026-09-03T07:40:00-05:00',kind:'text',context:context('new','cycle-09'),threadIds:['thread-making'],provenance:'synthetic'}
  ],
  loops:[
    {id:'loop-flowers',title:'Bring flowers to dinner',note:'Something simple from the corner shop.',status:'open',history:[],provenance:'synthetic'},
    {id:'loop-sketch',title:'See where the sketchbook leads',note:'A page here and there, with no finished piece in mind.',status:'evolving',echoId:'echo-table',history:[],provenance:'synthetic'},
    {id:'loop-walk',title:'Take that walk again',note:'An invitation I am bringing into this cycle.',status:'carried-forward',echoId:'echo-return',history:[{status:'open',at:'2026-09-10T23:20:00Z'},{status:'carried-forward',at:'2026-10-01T12:00:00Z'}],provenance:'synthetic'},
    {id:'loop-call',title:'Make time for a conversation',note:'We found an evening that worked for both of us.',status:'completed',echoId:'echo-call',history:[],provenance:'synthetic'}
  ],
  threads:[
    {id:'thread-space',title:'Room between things',description:'Walks, pauses, and a question left open. A connection made by the person in this demonstration.',echoIds:['echo-return','echo-call','echo-question','echo-water'],loopIds:['loop-walk']},
    {id:'thread-making',title:'Making without a map',description:'A sketchbook, a table, and the beginnings of an idea.',echoIds:['echo-first','echo-question','echo-table'],loopIds:['loop-sketch']}
  ],
  reflections:[
    {id:'reflection-person',echoId:'echo-water',author:'person',body:'The walk was the same length. I think what changed was how much I was asking it to do for me.',createdAt:'2026-10-09T20:10:00-05:00',provenance:'synthetic'},
    {id:'reflection-ai',echoId:'echo-question',author:'ai-assisted',body:'You mentioned leaving an idea unexplained here, and leaving a page open in an earlier Echo. Does that connection feel relevant to you, or are these different experiences?',createdAt:'2026-10-06T09:00:00-05:00',provenance:'synthetic'}
  ]
};
