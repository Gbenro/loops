// Luna Loops - Moon Phase Content
// Deep wisdom, guidance, and keywords for each of the 8 lunar phases

// Stable daily pick — same result for the day, different per pool, changes tomorrow
export function pickForToday(pool) {
  if (!Array.isArray(pool)) return pool;
  const seed = new Date().toDateString() + pool[0].slice(0, 8);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  }
  return pool[hash % pool.length];
}

// ─── New Moon tides ───────────────────────────────────────────────────────────

const NEW_MOON_TIDES = {
  opening: [
    'The dark has just begun. Let the silence be enough for now.',
    'Darkness arrives. There is nowhere to go yet — just be here.',
    'The new moon opens. Rest inside the not-yet-knowing.',
    'The cycle has reset. Let what is forming in you form slowly.',
    'The dark is fresh. Nothing needs to happen yet.',
  ],
  flowing: [
    'You are inside the new moon. Hold your intention quietly — do not rush it into the light.',
    'The darkness is full. What you carry inside it now will shape the whole cycle.',
    'You are in the quiet centre. Stay with your intention without forcing it forward.',
    'Inside the new moon. The seed you have planted does not need your attention — it needs your stillness.',
    'This is the most interior moment. What is forming does not yet have a name.',
  ],
  completing: [
    'The darkness is thinning. What seed did you plant? Feel it before it surfaces.',
    'The new moon is nearly done. What intention formed in the quiet?',
    'The dark is releasing. Your seed is near the surface — do not dig it up yet.',
    'The crescent is close. What did the silence clarify?',
    'The new moon has done its work. Something has formed. Trust it.',
  ],
  closing: [
    'The crescent is coming. Carry your intention forward into the growing light.',
    'The dark is ending. What you held in silence is ready to meet the light.',
    'The new moon gives way to the crescent. Take your seed into the building.',
    'The darkness releases you. Move forward with what formed inside it.',
    'First light is near. Your intention is ready. Step into the waxing.',
  ],
};

const NEW_MOON_DEEP_TIDES = {
  opening: [
    'The new moon has just opened. This is the most interior moment of the cycle — something is forming that does not yet have a name.',
    'The dark is new. Nothing is being asked of you yet except to be present to the emptiness — that emptiness is generative.',
    'The cycle has cleared. What the last moon held is gone. What this one will hold is not yet visible. Sit in that.',
    'The new moon opens in silence. Let it stay silent a little longer — what forms in quiet is stronger than what forms in noise.',
    'Darkness is not absence. The new moon is the most fertile moment — it simply asks you to trust that before the evidence arrives.',
  ],
  flowing: [
    'You are in the dark. This is not emptiness — it is gestation. What you hold quietly now will shape the whole cycle ahead.',
    'You are inside the new moon. The question it carries is forming in you beneath awareness. Stay still enough to feel it arrive.',
    'The dark has its own intelligence. You do not need to figure anything out right now — let the new moon do the figuring.',
    'You are at the seed stage. What you plant quietly in this darkness will determine the shape of everything that follows.',
    'Inside the new moon, the cycle is beginning itself without your help. Your role is receptivity, not direction.',
  ],
  completing: [
    'The new moon is finishing its work. The intention you have seeded is ready to meet the light. Trust what formed in the silence.',
    'The darkness is thinning. Something that was invisible is becoming visible. Notice what has clarified without you forcing it.',
    'The new moon has nearly done what it came to do. What arrived in the quiet? That is the seed you carry forward.',
    'The dark is completing. What you were willing to sit with in this phase has shaped your direction. Trust what emerged.',
    'The new moon closes its work. What formed in the dark belongs to you now. The crescent will begin to reveal it.',
  ],
  closing: [
    'The crescent is nearly here. The dark has done what it came to do. Move forward with what the stillness gave you.',
    'The new moon releases you into the waxing. What intention did the dark clarify? That is the thread you follow now.',
    'First light is coming. The most interior phase of the cycle is giving way to the most active. Carry the quiet with you.',
    'The darkness closes. The seed is planted. The crescent will begin to build on what was seeded in the silence.',
    'The new moon is past. The cycle begins to build from here. What you chose in the dark is now the direction.',
  ],
};

// ─── First Quarter tides ──────────────────────────────────────────────────────

const FIRST_QUARTER_TIDES = {
  opening: [
    'The tension is arriving. Something in you knows what needs to be decided.',
    'The quarter opens. Half-lit, half-dark — the same lives in you.',
    'A decision point has arrived. Do not look away from it.',
    'The threshold of decision. Something is being asked that cannot be halfway.',
    'The first quarter opens its question. What are you willing to commit to?',
  ],
  flowing: [
    'You are at the crossroads. The decision this phase is asking for will not make itself.',
    'Inside the decision. The obstacle this phase brings is not against you — it tests your roots.',
    'You are in it. Half the cycle has built toward this moment. What does it require of you?',
    'The quarter is live. What you commit to now carries the weight of the whole cycle.',
    'You are inside the tension. Stay with it — the answer is in here, not out there.',
  ],
  completing: [
    'The quarter is resolving. What you commit to now sets the direction for the full moon.',
    'The decision is crystallising. What have you been avoiding that this phase is asking you to face?',
    'The quarter threshold is nearly past. What has been clarified?',
    'The tension is easing. What emerged from it?',
    'The first quarter is finishing. Whatever was decided here is now in motion.',
  ],
  closing: [
    'The decision has been made, or it is being made. Move forward — the gibbous will refine what you chose.',
    'The quarter passes. What you committed to is real now. The waxing gibbous begins.',
    'The threshold closes. Take what was clarified and build on it.',
    'The decision point is behind you. The waxing gibbous opens — carry what you committed to.',
    'First quarter done. The cycle moves into refinement. What did you choose?',
  ],
};

const FIRST_QUARTER_DEEP_TIDES = {
  opening: [
    'The first quarter has arrived. Half-lit, half-dark — the same tension lives in you. Something is being asked for that cannot be halfway.',
    'A threshold is opening. The first quarter does not ask for comfort — it asks for honesty about what you are actually willing to do.',
    'The decision phase begins. What you planted at the new moon is now being tested. Does it have roots, or only wishes?',
    'The quarter opens with tension. That tension is useful — it is showing you exactly where the choice lives.',
    'The first quarter is a pressure point. Something that has been forming needs to become a commitment. What is it?',
  ],
  flowing: [
    'You are inside the decision. The obstacle this phase brings is not against you — it is testing whether your intention has roots.',
    'You are at the crossroads of the cycle. The waxing has carried you here. What will you actually commit to — not in principle, but in action?',
    'The first quarter holds tension that wants to resolve into decision. Do not resolve it too quickly — feel what is at stake first.',
    'You are in the middle of the threshold. Something in you is resisting, and something in you knows. Listen to both.',
    'The quarter is live. What you are avoiding looking at in this phase is usually what the phase is asking you to face.',
  ],
  completing: [
    'The threshold is finishing its work. What it clarified in you is becoming visible.',
    'The first quarter is completing. What you have committed to — or failed to commit to — is now clear. Both are information.',
    'The decision threshold is closing. Whatever was asked of you here, you have answered in some form. Own the answer.',
    'The quarter is resolving. What it showed you about yourself and your intention is worth holding.',
    'The first quarter completes its work. The waxing gibbous opens next — it will refine what you decided here.',
  ],
  closing: [
    'The threshold is nearly past. Carry what was revealed, and release the tension that no longer serves.',
    'The first quarter is giving way to the gibbous. What you committed to here is now the raw material of refinement.',
    'The decision is made, or it has been made for you by what you were and were not willing to do. Both are honest.',
    'The threshold closes. The waxing continues. What you carry from the quarter shapes the rest of the cycle.',
    'The quarter is behind you. The full moon will illuminate what this decision made possible — and what it cost.',
  ],
};

// ─── Full Moon tides ──────────────────────────────────────────────────────────

const FULL_MOON_TIDES = {
  opening: [
    'The peak is arriving. What this cycle has been building is becoming visible.',
    'The full moon is opening. Maximum light is almost here.',
    'The peak is near. Everything the cycle grew is about to be illuminated.',
    'The full moon rises. What was planted in the dark is fully visible now.',
    'The illumination begins. What has this cycle grown in you?',
  ],
  flowing: [
    'You are at maximum light. What the cycle has grown is fully illuminated now.',
    'Full light. What is true is visible. Some of what you see will be welcome — some will not.',
    'You are at the peak. The cycle has done its work — look at what it produced.',
    'Maximum illumination. The truth of this cycle is here. Receive it.',
    'You are inside the full moon. The light shows everything — especially what you have been avoiding.',
  ],
  completing: [
    'The full moon is at its height. What has been revealed cannot be unseen.',
    'The peak is completing its work. What truth arrived that you needed?',
    'The illumination is finishing. What it showed you belongs to you now.',
    'The full moon has done what it came to do. What was harvested?',
    'The peak has passed its height. What clarity arrived in the light?',
  ],
  closing: [
    'The light is beginning to wane. Take what was illuminated with you into the release.',
    'The full moon is giving way to the waning. What truth do you carry from the peak?',
    'The peak is behind you. The cycle turns toward release. What did the full moon show you?',
    'The waning begins. What the full moon illuminated is now yours to reckon with.',
    'The full moon closes. The light withdraws slowly. What remains true in the dark?',
  ],
};

const FULL_MOON_DEEP_TIDES = {
  opening: [
    'The full moon is opening. Everything the cycle has built is rising to the surface — what arrives now was seeded at the new moon.',
    'The peak is near. What you planted, built, decided, and refined is about to meet maximum light. What will it look like?',
    'The full moon rises. The cycle has been moving toward this illumination since the dark. What does the light reveal?',
    'The most visible moment of the cycle is arriving. What this cycle has truly been about is becoming undeniable.',
    'Maximum illumination is near. The full moon does not ask for more doing — it asks for honest seeing.',
  ],
  flowing: [
    'You are at the peak. The light shows what is true. Some of what you see will be welcome; some will not. Both are the harvest.',
    'You are in the full light. What the cycle built, and what it could not build, is equally visible now. Hold both with honesty.',
    'The full moon illuminates not just what you achieved but who you are in the achieving. What does the light show you?',
    'You are inside the peak. This is not a time for action — it is a time for clear seeing. What truth is the full moon bringing?',
    'Maximum light. The full moon reveals what was hidden by the dark of the new moon and the busyness of the waxing. What is here?',
  ],
  completing: [
    'The full moon is completing its work. What it has revealed is yours to reckon with. This is not the time to look away.',
    'The peak is finishing. What was illuminated at the full moon has shown you something. Hold it, even if it is uncomfortable.',
    'The full moon closes its revelation. What it clarified about this cycle — and about yourself — is the gift of the peak.',
    'The illumination completes. The harvest of this full moon belongs to you. Some of it is what you hoped; some of it is truth.',
    'The full moon is nearly past. What it revealed will not un-reveal itself. Take the clarity into the waning.',
  ],
  closing: [
    'The full moon is passing. The light has shown what it came to show. Carry the truth of it into the waning — that is what release is made from.',
    'The peak gives way to the waning. What the full moon illuminated is now the compass for what needs to be released.',
    'The full moon closes. The waning begins. What you harvested in the light becomes the weight you carry into the release.',
    'The illumination is behind you. What remains after the peak is what is truly yours — the rest will release itself in the waning.',
    'The full moon is past. The cycle turns inward and downward. What you saw clearly at the peak stays with you as a guide.',
  ],
};

// ─── Last Quarter tides ───────────────────────────────────────────────────────

const LAST_QUARTER_TIDES = {
  opening: [
    'The release is beginning. What did not complete wants to be let go now.',
    'The last quarter opens. What from this cycle needs to end?',
    'A reckoning arrives. Half-lit again, but releasing — what did not work?',
    'What are you still holding that no longer serves? This phase asks you to see it clearly.',
    'The last quarter. A clear-eyed letting go is being asked of you.',
  ],
  flowing: [
    'You are inside the clearing. What you release here makes room for the new cycle.',
    'You are in the release. This is not failure — it is completion.',
    'Inside the last quarter. What you let go of now is an act of care for what comes next.',
    'The clearing is underway. What are you still carrying that belongs to this cycle and not the next?',
    'You are in the surrender. Let the cycle complete what it came to complete.',
  ],
  completing: [
    'The last quarter is finishing its work. What are you still holding that no longer serves?',
    'The clearing is nearly done. What you surrender now becomes the compost for the next beginning.',
    'The release is completing. What remains to let go?',
    'The last quarter closes its work. The waning crescent is near — bring the clearing to rest.',
    'Nearly through. The release has done its work. What did you let go that needed to go?',
  ],
  closing: [
    'Set down what belongs to this cycle. The new moon will ask for only what is true.',
    'The last quarter is past. The waning crescent opens — the final rest before renewal.',
    'Release is complete. The darkness is close. You are lighter than you were.',
    'The last quarter gives way to the crescent dark. Whatever remains to release, release it now.',
    'The threshold is behind you. The final phase opens — rest, and let the cycle breathe down.',
  ],
};

const LAST_QUARTER_DEEP_TIDES = {
  opening: [
    'The last quarter has opened. Half the light remains — and with it, a clear-eyed reckoning. What from this cycle needs to end before the dark arrives?',
    'The last threshold of the cycle. What the full moon illuminated now meets the question of release. What are you holding that the new cycle cannot carry?',
    'The last quarter opens with honesty. This phase does not ask if you succeeded — it asks what you are willing to set down.',
    'A reckoning is beginning. The last quarter brings not failure but completion — and completion requires acknowledging what did not close.',
    'The release phase opens. What the cycle has built and illuminated now asks to be let go of what no longer belongs. What is that?',
  ],
  flowing: [
    'You are in the release. This is not failure — it is completion. What you let go of here is an act of care for the cycle that follows.',
    'You are inside the clearing. The last quarter asks you to be honest about what did not work, what did not close, what needs to go.',
    'The release is underway. What you are willing to surrender here defines how free you arrive at the new moon.',
    'You are in the last quarter threshold. What you have been avoiding releasing is exactly what this phase is here to help with.',
    'The clearing continues. Some releases are obvious; some ask you to look deeper. What are you still pretending belongs to you?',
  ],
  completing: [
    'The last quarter is closing. What was cleared, what was released, what was surrendered — all of it is becoming the compost of the next beginning.',
    'The clearing completes. What you surrender now is not lost — it becomes the ground for what the new moon will plant.',
    'The last quarter finishes its work. What remains to release will either go now or be carried into the next cycle. Choose.',
    'The threshold is nearly past. What it asked of you — honestly releasing what did not serve — has been answered in some form.',
    'The last quarter completes. The waning crescent is next. The heaviest work of releasing is behind you.',
  ],
  closing: [
    'The last quarter is nearly past. Whatever was decided here — consciously or not — is already in motion. The waning crescent opens.',
    'The threshold closes. Whatever remains to release, release it now. The waning crescent does not ask for the same depth — but the new moon will.',
    'The last quarter is passing. The final quiet of the waning crescent is next. Arrive at it as light as you can.',
    'The release phase closes. The dark is coming. What you set down here will not need to be carried into the new cycle.',
    'The last quarter is behind you. The cycle is completing its arc. Trust the process of ending — it is making space for the beginning.',
  ],
};

// ─── Waxing Crescent tides ────────────────────────────────────────────────────

const WAXING_CRESCENT_TIDES = {
  opening: [
    'The crescent is just forming. You have the full phase ahead — begin with one step.',
    'First light. The cycle is beginning to build — what is your first move?',
    'The crescent opens. Momentum wants to start. Give it something small to work with.',
    'The building phase begins. Plant your first action in it while the energy is fresh.',
    'The waxing crescent arrives. Begin before you are ready — the phase is long enough.',
  ],
  flowing: [
    'The build is underway. What you put in now compounds.',
    'You are in the rising energy. Keep going — each action builds on the last.',
    'The crescent is growing. The work you are doing now is accumulating.',
    'You are inside the build. Momentum is with you — use it.',
    'The waxing is in flow. What you sustain now becomes the foundation the full moon will illuminate.',
  ],
  completing: [
    'The crescent is thinning toward the quarter. Close what you opened before the decision phase arrives.',
    'The build is nearly done. The first quarter decision point is coming — consolidate now.',
    'The crescent is completing. What needs to be in place before the threshold arrives?',
    'The waxing crescent is finishing. What did you build? The first quarter will test it.',
    'The phase winds toward decision. Land what you have moved before the quarter asks you to commit.',
  ],
  closing: [
    'The first quarter is near. Bring your early movement to a point.',
    'The crescent is almost done. What has been built is about to meet its decision point.',
    'The first quarter is hours away. Finish what you started — the threshold is close.',
    'The crescent closes. Take what you built into the first quarter with confidence.',
    'The build is done. The decision phase arrives next — step into it with what you have.',
  ],
};

const WAXING_CRESCENT_DEEP_TIDES = {
  opening: [
    'The crescent is opening. The full arc of this phase lies ahead — plant yourself in it before the momentum takes over.',
    'The first light of the new cycle. The seed planted in the dark is now becoming a direction. What is your first move?',
    'The waxing crescent opens. Energy wants to move. Give it a form before it scatters.',
    'The building has begun. The crescent asks not for perfection but for a first step — the momentum will build from there.',
    'The crescent opens the waxing. What you do now is not yet visible as a pattern — but it is becoming one.',
  ],
  flowing: [
    'You are building. What you sustain now becomes the foundation the full moon will illuminate.',
    'You are in the rising current. The waxing crescent rewards consistency more than inspiration — show up again.',
    'The build is flowing. What you are doing now is compounding. Keep the momentum rather than starting fresh.',
    'You are inside the crescent phase. What you are building has its own logic — trust it and keep moving.',
    'The waxing is in motion. Resistance now is normal — the crescent phase always asks for effort before it gives back.',
  ],
  completing: [
    'The crescent is ending. What you set in motion here will meet its first real test at the quarter. Consolidate before that threshold.',
    'The build phase is closing. What you have done in the crescent is now the raw material the first quarter will challenge.',
    'The waxing crescent completes. What have you actually moved? The first quarter will ask you to commit to it.',
    'The crescent is finishing its arc. The decision point is near — make sure what you have built is honest.',
    'The building is nearly done. Land what you can before the first quarter asks what you are willing to stand behind.',
  ],
  closing: [
    'The first quarter is arriving. Bring your intentions to a point. The next phase demands a decision.',
    'The crescent closes. The threshold opens. What you built in the waxing is about to be tested by the decision phase.',
    'The build is behind you. The first quarter arrives to ask: what are you actually committing to? Have an answer.',
    'The crescent is done. The quarter threshold is hours away. Take what you built and prepare to commit to it.',
    'The waxing crescent is past. The decision phase opens. What you built here is good enough — trust it.',
  ],
};

// ─── Waxing Gibbous tides ─────────────────────────────────────────────────────

const WAXING_GIBBOUS_TIDES = {
  opening: [
    'The gibbous opens wide. You are close — use this phase to refine, not rebuild.',
    'Almost full. The work is mostly done — now sharpen what exists.',
    'The waxing gibbous arrives. Trust what you built. Adjust the edges.',
    'The refining phase begins. You are near the peak — stop adding, start improving.',
    'The gibbous opens. The full moon is coming — make what you have ready for the light.',
  ],
  flowing: [
    'Refinement is the work now. Adjust the details. The full moon is coming.',
    'You are in the final push. Not rebuilding — refining. Trust what is already here.',
    'The gibbous is flowing. What small adjustments will make the biggest difference?',
    'You are deep in the waxing gibbous. The full moon will illuminate what you have — make sure it is honest.',
    'Close to the peak. Stay with what you built. Refine it. Trust it.',
  ],
  completing: [
    'The peak is near. What needs one last adjustment before the light arrives?',
    'The gibbous is completing. The full moon is close — what still needs attention?',
    'Almost there. One final look — then trust what you have built.',
    'The full moon is hours away. Is what you built ready for the light?',
    'The refining phase is ending. What is the last thing that needs to be in place?',
  ],
  closing: [
    'The full moon is hours away. What you have refined is ready. Stop changing it.',
    'The gibbous closes. The full moon arrives next — step into it with what you have built.',
    'The peak is arriving. The refinement is done. Let it be illuminated.',
    'The full moon is near. Trust what you built and refined. It is enough.',
    'The gibbous is done. What you shaped in this phase meets the full moon now.',
  ],
};

const WAXING_GIBBOUS_DEEP_TIDES = {
  opening: [
    'The gibbous phase opens. Most of the work has been done — now the task is trust and precision, not effort.',
    'The waxing gibbous arrives with anticipation. The full moon is coming — refine what you have built rather than building something new.',
    'You are near the peak. The gibbous phase rewards finishing over starting. What needs to be completed, not begun?',
    'The refining phase opens. You are close to the illumination — the question now is not what to add but what to clarify.',
    'The gibbous opens. The temptation to rebuild is strong when you can see the peak — resist it. What exists is nearly ready.',
  ],
  flowing: [
    'You are refining. Resist the urge to start something new. What exists is nearly ready.',
    'You are in the waxing gibbous. The work of this phase is trust — trusting what you built enough to refine it rather than replace it.',
    'The refinement continues. Each small adjustment in the gibbous compounds toward the full moon. Be precise, not exhaustive.',
    'You are inside the anticipation. The full moon is coming — what you are building now is what will be illuminated. Make it true.',
    'The waxing gibbous rewards patience with detail. What do you see now that you could not see earlier in the cycle?',
  ],
  completing: [
    'The full moon is close. Refinement should be finishing, not beginning. Let what you have be enough.',
    'The gibbous completes. The full moon is near. What you have built and refined is what will be illuminated — trust it.',
    'The waxing is nearly at its peak. What is left to refine? If the answer is everything, the real work is learning to trust.',
    'The gibbous is in its final arc. The full moon does not ask for perfection — it asks for honesty. Is what you built honest?',
    'The peak is near. Final refinements are finishing. What is ready to step into the light as it is?',
  ],
  closing: [
    'The peak is upon you. The gibbous has done its work. Step into the full moon with what you have built.',
    'The waxing gibbous closes. The full moon is hours away. What you refined here is what will be shown — trust it.',
    'The gibbous is done. The illumination begins. The long work of building and refining has led to this moment.',
    'The refining phase closes. The full moon opens. What you shaped in the gibbous is ready for the light.',
    'The waxing is complete. The full moon is here. Trust what the whole arc of the waxing produced.',
  ],
};

// ─── Waning Gibbous tides ─────────────────────────────────────────────────────

const WANING_GIBBOUS_TIDES = {
  opening: [
    'The peak has just passed. You have the whole waning gibbous to integrate and share what arose.',
    'The full moon is behind you. The sharing phase opens — what did the peak give you to offer?',
    'The waning gibbous begins. The work now is outward — share, give, teach.',
    'The light begins to recede. What you gathered at the full moon is meant to move outward now.',
    'The peak has passed. The cycle turns toward generosity — what do you have to give?',
  ],
  flowing: [
    'The light is slowly leaving. Give back what the cycle has given you.',
    'You are in the integration. What the full moon revealed is becoming something you can offer.',
    'The waning gibbous flows. Share what you know. Teach what you learned. Give what arrived.',
    'You are inside the sharing phase. What the cycle built in you is most useful when it moves through you.',
    'The light is waning and the generosity is rising. What wants to be passed on?',
  ],
  completing: [
    'The gibbous is closing. What you have learned needs to land — share it before the last quarter.',
    'The waning gibbous is completing. What was shared? What still wants to be offered?',
    'The sharing phase is nearly done. The last quarter threshold is close — what did you give?',
    'The integration is finishing. What have you passed on from this cycle\'s harvest?',
    'The waning gibbous closes. The last quarter arrives next — a reckoning follows generosity.',
  ],
  closing: [
    'The last quarter threshold is near. Finish sharing. A reckoning is coming.',
    'The waning gibbous is done. What you gave from the harvest now moves into release.',
    'The sharing phase closes. The last quarter opens next — what needs to be let go?',
    'The gibbous waning is past. A threshold approaches — finish what you started giving.',
    'The last quarter is arriving. The giving is done. Now comes the clearing.',
  ],
};

const WANING_GIBBOUS_DEEP_TIDES = {
  opening: [
    'The full moon has passed. This phase is the cycle\'s most generous — let what you received begin to move outward.',
    'The waning gibbous opens. The illumination of the full moon is still fresh. What did it show you that wants to be shared?',
    'The sharing phase begins. What the cycle built and the full moon revealed now asks to be given — not hoarded.',
    'The light is receding and the generosity is rising. The waning gibbous is the cycle\'s moment of outward movement.',
    'The gibbous waning opens. You have received the illumination — now the cycle asks what you will do with it.',
  ],
  flowing: [
    'You are integrating. What the full moon revealed wants to become something you can offer. Share, teach, pass on.',
    'You are in the waning gibbous. The cycle is moving outward through you. What you give in this phase has been built by the whole arc.',
    'The sharing is underway. What arrived in the full moon is most powerful when it passes through you to someone else.',
    'You are inside the generous phase. What have you learned? What have you built? Who needs it? Give it.',
    'The integration deepens. The full moon showed you something — the waning gibbous asks you to act on what you saw.',
  ],
  completing: [
    'The gibbous waning is closing. What was shared and integrated will be tested at the last quarter — prepare to let go.',
    'The sharing phase is nearly past. What from this cycle\'s harvest have you passed on? What remains to offer?',
    'The waning gibbous completes. What you gave in this phase is already doing its work — trust it.',
    'The gibbous closes toward the last quarter. The sharing is finishing. The next phase asks for release, not giving.',
    'The integration is complete. What moved through you in the sharing phase is now doing its own work in the world.',
  ],
  closing: [
    'The last quarter threshold is near. What was gathered, shared, and integrated in this phase now approaches its release. Let the tide turn.',
    'The waning gibbous closes. The last quarter is arriving. The generosity is done — the reckoning opens.',
    'The sharing phase passes. The last quarter threshold arrives next — a different kind of honesty is needed now.',
    'The gibbous is behind you. The last quarter opens. What the generous phase built now meets the release phase.',
    'The waning gibbous is done. The cycle moves from giving to releasing. Both are necessary. Both are acts of care.',
  ],
};

// ─── Waning Crescent tides ────────────────────────────────────────────────────

const WANING_CRESCENT_TIDES = {
  opening: [
    'The final phase opens. Let the cycle breathe down.',
    'The waning crescent begins. Rest is the only work now.',
    'The last sliver of light. The cycle is completing — do not start anything new.',
    'The final dark is approaching. This phase asks for stillness, not action.',
    'The crescent wanes. The cycle is finishing its arc. Follow it into the quiet.',
  ],
  flowing: [
    'You are in the slowest, darkest part. This is not a time to push.',
    'The darkness is gathering. Let it come. Trust the quiet.',
    'You are in the fallow time. The cycle is integrating everything it went through. Rest with it.',
    'The waning crescent flows toward dark. What wants to be released before the new cycle opens?',
    'You are in the deepest rest. What wants to drop from you before the new moon?',
  ],
  completing: [
    'The darkness is almost complete. What remains can wait for the new cycle.',
    'The crescent is nearly gone. The new moon is very close — let the last of this cycle go.',
    'The waning crescent is finishing. What from this cycle are you ready to release to the dark?',
    'Almost at the new moon. The old cycle is completing. Offer what remains to the darkness.',
    'The cycle is nearly done. Be still. The dark will take what needs to go.',
  ],
  closing: [
    'The new moon is near. Release the last of what this cycle held.',
    'The crescent vanishes. The new moon is hours away — arrive at it empty.',
    'The cycle completes. What you carried through it is done. The dark receives it.',
    'The last light fades. The new moon opens next. Let this cycle close fully.',
    'The waning crescent closes. Something new is forming in the approaching dark. Make room for it.',
  ],
};

const WANING_CRESCENT_DEEP_TIDES = {
  opening: [
    'The last phase begins. The cycle is completing itself — your work now is restoration, not production.',
    'The waning crescent opens the final arc. What the cycle has been is becoming what it was. Let it finish.',
    'The last quiet before the dark. The waning crescent asks you to slow all the way down.',
    'The final phase opens. What does the cycle need from you to complete? Probably less than you think.',
    'The crescent wanes. The cycle is pulling inward. Follow it — this is not the time to push outward.',
  ],
  flowing: [
    'You are in the fallow period. The darkness before the new moon has its own intelligence. Trust what rises in stillness.',
    'You are in the deepest part of the cycle. The waning crescent asks nothing of you except presence and rest.',
    'The quiet is full. What the cycle has been through is being integrated in the dark. Let it do that without interruption.',
    'You are inside the last phase. The cycle is breathing down. Breathe down with it.',
    'The waning crescent is the cycle\'s permission to stop. Stop. Rest. Let what wants to release, release.',
  ],
  completing: [
    'The new moon is approaching. What this cycle has taught you is settling in. Do not force conclusions.',
    'The crescent is nearly gone. The new cycle is already forming in the dark. What are you bringing to it?',
    'The darkness is almost complete. The cycle has nearly run its arc. What remains to release before the new moon?',
    'The waning crescent finishes. What the cycle planted, built, illuminated, and released is now settling into rest.',
    'Almost dark. The cycle is completing. What do you want to leave behind and what do you want to carry forward?',
  ],
  closing: [
    'The new moon is nearly here. The old cycle is done. Allow the darkness to complete its work — something new is forming in the quiet.',
    'The crescent closes. The new moon opens. What you carried through this cycle has shaped the seed of the next.',
    'The cycle ends. The dark arrives. Something new is already forming. Trust the turn.',
    'The waning crescent passes. The new moon is here. The whole cycle has led to this next beginning.',
    'The last light is gone. The new cycle opens in the dark. Arrive at it open — the old cycle is complete.',
  ],
};

export const phaseContent = {
  'new': {
    title: 'New Moon',
    symbol: '🌑',
    energy: 'Seed',
    phaseType: 'threshold',
    typeOpening: NEW_MOON_TIDES,
    deepTides: NEW_MOON_DEEP_TIDES,
    guidance: 'Plant intentions. What do you want to call into this cycle?',
    deep: 'The dark between cycles. Seeds germinate in darkness. Set intentions privately. Let them form before light reveals them.',
    keywords: ['Intention', 'Darkness', 'Reset', 'Silence', 'Potential'],
    asks: 'What seeds do you want to plant?',
    loopAdvice: 'Open new loops. Set fresh intentions. Start quiet.',
  },

  'waxing-crescent': {
    title: 'Waxing Crescent',
    symbol: '🌒',
    energy: 'Build',
    phaseType: 'flow',
    typeOpening: WAXING_CRESCENT_TIDES,
    deepTides: WAXING_CRESCENT_DEEP_TIDES,
    guidance: 'The energy is rising. Push forward. Open new loops.',
    deep: 'First light after darkness. The cycle begins. Take small steps forward. Build momentum. Trust your direction.',
    keywords: ['Emergence', 'Momentum', 'Courage', 'Beginning', 'Growth'],
    asks: 'What first step can you take today?',
    loopAdvice: 'Build momentum. Add structure to your intentions.',
  },

  'first-quarter': {
    title: 'First Quarter',
    symbol: '🌓',
    energy: 'Decide',
    phaseType: 'threshold',
    typeOpening: FIRST_QUARTER_TIDES,
    deepTides: FIRST_QUARTER_DEEP_TIDES,
    guidance: 'Commit. Decisions made now carry real weight.',
    deep: 'Half-lit, half-dark. Tension and decision. Obstacles test your intention. Commit fully or let go.',
    keywords: ['Decision', 'Tension', 'Commitment', 'Action', 'Challenge'],
    asks: 'What are you willing to commit to fully?',
    loopAdvice: 'Face obstacles. Make decisions. Push through.',
  },

  'waxing-gibbous': {
    title: 'Waxing Gibbous',
    symbol: '🌔',
    energy: 'Refine',
    phaseType: 'flow',
    typeOpening: WAXING_GIBBOUS_TIDES,
    deepTides: WAXING_GIBBOUS_DEEP_TIDES,
    guidance: "You're close. Adjust, trust, keep going.",
    deep: 'Almost full. Refine, don\'t revolutionize. Adjust the details. The peak approaches. Trust what you\'ve built.',
    keywords: ['Refinement', 'Anticipation', 'Adjustment', 'Nearing', 'Clarity'],
    asks: 'What needs refining before completion?',
    loopAdvice: 'Refine loops. Adjust details. Trust progress.',
  },

  'full': {
    title: 'Full Moon',
    symbol: '🌕',
    energy: 'Illuminate',
    phaseType: 'threshold',
    typeOpening: FULL_MOON_TIDES,
    deepTides: FULL_MOON_DEEP_TIDES,
    guidance: 'Peak. What has this cycle revealed about you?',
    deep: 'Maximum light. Everything illuminated. Harvest what has grown. See clearly. Feel fully. Let truth arrive.',
    keywords: ['Revelation', 'Harvest', 'Illumination', 'Completion', 'Truth'],
    asks: 'What has this cycle revealed?',
    loopAdvice: 'Celebrate completions. See clearly. Let go of what the light reveals.',
  },

  'waning-gibbous': {
    title: 'Waning Gibbous',
    symbol: '🌖',
    energy: 'Share',
    phaseType: 'flow',
    typeOpening: WANING_GIBBOUS_TIDES,
    deepTides: WANING_GIBBOUS_DEEP_TIDES,
    guidance: 'Give back what you have gathered. Reflect and release.',
    deep: 'The peak has passed. Share what you\'ve learned. Give back. Gratitude flows naturally now.',
    keywords: ['Gratitude', 'Sharing', 'Integration', 'Generosity', 'Wisdom'],
    asks: 'What can you share with others?',
    loopAdvice: 'Share progress. Teach what you learned. Begin releasing.',
  },

  'last-quarter': {
    title: 'Last Quarter',
    symbol: '🌗',
    energy: 'Release',
    phaseType: 'threshold',
    typeOpening: LAST_QUARTER_TIDES,
    deepTides: LAST_QUARTER_DEEP_TIDES,
    guidance: "Let go of what didn't close. Clear space.",
    deep: 'Half-lit again, but releasing. What didn\'t work? Let it go. Clear the field for what\'s next.',
    keywords: ['Release', 'Forgiveness', 'Clearing', 'Surrender', 'Space'],
    asks: 'What do you need to release?',
    loopAdvice: 'Close incomplete loops. Clear what blocks you. Forgive.',
  },

  'waning-crescent': {
    title: 'Waning Crescent',
    symbol: '🌘',
    energy: 'Rest',
    phaseType: 'flow',
    typeOpening: WANING_CRESCENT_TIDES,
    deepTides: WANING_CRESCENT_DEEP_TIDES,
    guidance: 'The cycle completes. Be still. Restore.',
    deep: 'Final sliver before darkness. Rest deeply. Dream. Don\'t start new things. Let the cycle complete.',
    keywords: ['Rest', 'Mystery', 'Restoration', 'Endings', 'Surrender'],
    asks: 'How can you rest more deeply?',
    loopAdvice: 'Rest. Do not open new loops. Let the cycle complete.',
  },
};

export function getPhaseContent(key) {
  return phaseContent[key] || phaseContent['new'];
}
