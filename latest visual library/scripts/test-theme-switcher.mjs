import assert from 'node:assert/strict';
import { applyThemeInput, resolveThemeInput } from '../lib/rive/themeSwitcher.js';

function makeInput(name, type, value = false) {
  return {
    name,
    type,
    value,
    fireCount: 0,
    triggerCount: 0,
    fire() { this.fireCount += 1; },
    trigger() { this.triggerCount += 1; },
  };
}

function makeRiveWithInputs(inputs) {
  return {
    playingStateMachineNames: ['Main'],
    stateMachineNames: ['Main'],
    stateMachineInputs(name) {
      assert.equal(name, 'Main');
      return inputs;
    },
  };
}

function makeVmProp(name, type, value = false) {
  return { name, type, value, triggerCount: 0, trigger() { this.triggerCount += 1; } };
}

{
  const unrelated = makeInput('showTooltip', 59, false);
  const darkMode = makeInput('isDarkMode', 59, false);
  const resolved = resolveThemeInput(makeRiveWithInputs([unrelated, darkMode]), 'Main');
  assert.equal(resolved.kind, 'boolean');
  assert.equal(resolved.input, darkMode);
  assert.equal(applyThemeInput(resolved, true), true);
  assert.equal(darkMode.value, true);
  assert.equal(unrelated.value, false);
}

{
  const light = makeInput('setLightTheme', 58);
  const dark = makeInput('setDarkTheme', 58);
  const resolved = resolveThemeInput(makeRiveWithInputs([light, dark]), 'Main');
  assert.equal(resolved.kind, 'trigger-pair');
  assert.equal(applyThemeInput(resolved, true), true);
  assert.equal(dark.fireCount, 1);
  assert.equal(light.fireCount, 0);
  assert.equal(applyThemeInput(resolved, false), true);
  assert.equal(light.fireCount, 1);
}

{
  const unrelated = makeVmProp('showSparkle', 'boolean', false);
  const darkMode = makeVmProp('dark_theme', 'boolean', false);
  const rive = {
    stateMachineNames: [],
    playingStateMachineNames: [],
    viewModelInstance: {
      properties: [unrelated, darkMode],
      boolean(name) {
        return name === darkMode.name ? darkMode : unrelated;
      },
      trigger() { return null; },
    },
  };
  const resolved = resolveThemeInput(rive, null);
  assert.equal(resolved.kind, 'vm-boolean');
  assert.equal(resolved.input, darkMode);
  assert.equal(applyThemeInput(resolved, true), true);
  assert.equal(darkMode.value, true);
  assert.equal(unrelated.value, false);
}

{
  const toggle = makeInput('toggleTheme', 58);
  const resolved = resolveThemeInput(makeRiveWithInputs([toggle]), 'Main');
  assert.equal(resolved.kind, 'trigger');
  assert.equal(applyThemeInput(resolved, true, { commitToggle: false }), false);
  assert.equal(toggle.fireCount, 0);
  assert.equal(applyThemeInput(resolved, true, { commitToggle: true }), true);
  assert.equal(toggle.fireCount, 1);
}

console.log('theme switcher tests passed');
