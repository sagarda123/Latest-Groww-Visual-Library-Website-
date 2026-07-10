import assert from 'node:assert/strict';

globalThis.window = {
  rive: {
    Layout: class Layout {
      constructor(options) {
        this.options = options;
      }
    },
  },
};

const {
  primePausedPlaybackPreview,
  resetPlaybackToFirstFrame,
  resolvePlaybackArtboard,
  playbackConfigFromRecord,
} = await import('../lib/rive/rivePlayback.js');

// ── resolvePlaybackArtboard ───────────────────────────────────────────────
// Single artboard → that artboard, no override.
{
  const abs = [{ name: 'RiveXArtboardStory', animations: ['Timeline 1'], stateMachines: [] }];
  assert.equal(resolvePlaybackArtboard(abs, 'RiveXArtboardStory').name, 'RiveXArtboardStory');
}

// Empty auto-named default ("Artboard") + a richer named artboard → pick the
// richer one (the trigger_order case: real cursor scene lives on artboard 2).
{
  const abs = [
    { name: 'Artboard', animations: ['Timeline 1'], stateMachines: ['State Machine 1'] },
    { name: 'Trigger order GTM (light) final (1)', animations: ['Timeline 1', 'Trigger order GTM (light) final'], stateMachines: ['State Machine 1'] },
  ];
  assert.equal(resolvePlaybackArtboard(abs, 'Artboard').name, 'Trigger order GTM (light) final (1)');
}

// A descriptive default name is never overridden, even if another is richer.
{
  const abs = [
    { name: 'Main', animations: ['Timeline 1'], stateMachines: [] },
    { name: 'Extras', animations: ['a', 'b', 'c'], stateMachines: ['x'] },
  ];
  assert.equal(resolvePlaybackArtboard(abs, 'Main').name, 'Main');
}

// Placeholder default that is itself the richest → keep it.
{
  const abs = [
    { name: 'Artboard', animations: ['a', 'b'], stateMachines: ['x'] },
    { name: 'Empty', animations: [], stateMachines: [] },
  ];
  assert.equal(resolvePlaybackArtboard(abs, 'Artboard').name, 'Artboard');
}

// No metadata → null (caller falls back to runtime default artboard).
assert.equal(resolvePlaybackArtboard([], 'x'), null);
assert.equal(resolvePlaybackArtboard(undefined, 'x'), null);

// ── playbackConfigFromRecord ──────────────────────────────────────────────
// Chosen artboard with a state machine → artboard + stateMachines.
{
  const cfg = playbackConfigFromRecord(
    { stateMachines: [{ name: 'Default SM' }] },
    { name: 'Real AB', animations: ['Timeline 1'], stateMachines: ['State Machine 1'] },
  );
  assert.deepEqual(cfg, { artboard: 'Real AB', stateMachines: 'State Machine 1' });
}

// Chosen artboard with only a timeline → artboard + animations.
{
  const cfg = playbackConfigFromRecord(
    {},
    { name: 'Real AB', animations: ['Intro'], stateMachines: [] },
  );
  assert.deepEqual(cfg, { artboard: 'Real AB', animations: 'Intro' });
}

// No chosen artboard → backward-compatible flat-list behavior.
{
  assert.deepEqual(playbackConfigFromRecord({ stateMachines: [{ name: 'SM' }] }, null), { stateMachines: 'SM' });
  assert.deepEqual(playbackConfigFromRecord({ stateMachines: [], timelines: ['T'] }, null), { animations: 'T' });
  assert.deepEqual(playbackConfigFromRecord({}, null), {});
}

// Build a Rive stub backed by a single state machine plus a ViewModel that
// exposes one trigger property (mimics the text/cursor reveal triggers).
function makeSMWithVMTrigger(triggerCalls, calls) {
  return {
    durations: [1],
    playingStateMachineNames: [],
    stateMachineNames: ['Main'],
    animationNames: [],
    viewModelInstance: {
      properties: [{ name: 'riveXTriggerOnHover', type: 'trigger' }],
      trigger(name) {
        return { trigger: () => triggerCalls.push(name) };
      },
    },
    play(name) { calls.push(['play', name]); },
    reset(options) { calls.push(['reset', options]); },
    scrub(name, time) { calls.push(['scrub', name, time]); },
    pause() { calls.push(['pause']); },
    resizeDrawingSurfaceToCanvas() { calls.push(['resize']); },
  };
}

// resetPlaybackToFirstFrame — timeline animation, normal (re-primes playback).
{
  const calls = [];
  const rive = {
    durations: [2.4],
    playingStateMachineNames: [],
    stateMachineNames: [],
    playingAnimationNames: [],
    animationNames: ['Idle'],
    play(name) { calls.push(['play', name]); },
    reset(options) { calls.push(['reset', options]); },
    scrub(name, time) { calls.push(['scrub', name, time]); },
    pause() { calls.push(['pause']); },
    resizeDrawingSurfaceToCanvas() { calls.push(['resize']); },
  };

  resetPlaybackToFirstFrame(rive);

  assert.deepEqual(calls, [
    ['reset', { autoplay: false }],
    ['play', 'Idle'],
    ['scrub', 'Idle', 0],
    ['pause'],
    ['resize'],
  ]);
}

// primePausedPlaybackPreview — normal animation FIRES safe VM triggers so
// text/cursor layers are visible in the resting preview (regression: these
// layers used to stay invisible until the first hover).
{
  const triggerCalls = [];
  const calls = [];
  const rive = makeSMWithVMTrigger(triggerCalls, calls);

  primePausedPlaybackPreview(rive, false);

  assert.deepEqual(triggerCalls, ['riveXTriggerOnHover']);
  assert.deepEqual(calls, [
    ['play', 'Main'],
    ['scrub', 'Main', 0],
    ['pause'],
    ['resize'],
  ]);
}

// primePausedPlaybackPreview — ThemeSwitcher tile SKIPS triggers (its toggle
// owns the inputs); default arg also skips nothing extra beyond firing.
{
  const triggerCalls = [];
  const calls = [];
  const rive = makeSMWithVMTrigger(triggerCalls, calls);

  primePausedPlaybackPreview(rive, true);

  assert.deepEqual(triggerCalls, []);
  assert.deepEqual(calls, [
    ['play', 'Main'],
    ['scrub', 'Main', 0],
    ['pause'],
    ['resize'],
  ]);
}

// resetPlaybackToFirstFrame — normal animation re-fires safe VM triggers after
// the reset so VM-driven layers stay visible on mouse-leave.
{
  const triggerCalls = [];
  const calls = [];
  const rive = makeSMWithVMTrigger(triggerCalls, calls);

  resetPlaybackToFirstFrame(rive, false);

  assert.deepEqual(triggerCalls, ['riveXTriggerOnHover']);
  assert.deepEqual(calls, [
    ['reset', { autoplay: false }],
    ['play', 'Main'],
    ['scrub', 'Main', 0],
    ['pause'],
    ['resize'],
  ]);
}

// resetPlaybackToFirstFrame — ThemeSwitcher tile SKIPS triggers on reset.
{
  const triggerCalls = [];
  const calls = [];
  const rive = makeSMWithVMTrigger(triggerCalls, calls);

  resetPlaybackToFirstFrame(rive, true);

  assert.deepEqual(triggerCalls, []);
  assert.deepEqual(calls, [
    ['reset', { autoplay: false }],
    ['play', 'Main'],
    ['scrub', 'Main', 0],
    ['pause'],
    ['resize'],
  ]);
}

console.log('rive playback tests passed');
