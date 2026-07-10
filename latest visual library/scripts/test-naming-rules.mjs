import assert from 'node:assert/strict';
import { validate, RULES } from '../lib/rive/namingRules.js';

const ok = (type, name) => assert.equal(validate(type, name).ok, true, `${type} should accept "${name}"`);
const bad = (type, name) => assert.equal(validate(type, name).ok, false, `${type} should reject "${name}"`);

// file
ok('file', 'mds_rive_gtmstory_1_stocks_technicals');
ok('file', 'mds_rive_onboarding_s1_v2');
ok('file', 'mds_rive_interaction_checkbox.riv'); // extension stripped
bad('file', 'gtm_story_final');
bad('file', 'mds_rive_CamelCase');
bad('file', 'mds_rive_');
bad('file', 'Trigger order GTM (light) final (1)');

// icon
ok('icon', 'mds_ic_huge_add_circle');
bad('icon', 'add_circle');
bad('icon', 'mds_ic_huge_Add');

// illustration
ok('illustration', 'mds_il_hero_risk_fno');
ok('illustration', 'mds_il_hero_error_refresh');
ok('illustration', 'mds_il_spot_hero_calendar');
ok('illustration', 'mds_il_spot_hero_document_folder');
ok('illustration', 'mds_il_illustrated_icon_mf_nfo');
ok('illustration', 'mds_il_illustrated_icon_mf_top_companies');
bad('illustration', 'risk_fno');
bad('illustration', 'calendar');
bad('illustration', 'mds_il_banner_foo');       // not a valid type
bad('illustration', 'mds_il_hero_Stocks_SIP');  // uppercase

// artboard / component
ok('artboard', 'RiveXAbLoaderIcon');
bad('artboard', 'RiveXArtboardStory'); // known sample violation
bad('artboard', 'Artboard');
bad('artboard', 'Trigger order GTM (light) final (1)');
ok('component', 'RiveXCompSpinner');
bad('component', 'RiveXcompSpinner');

// view model / state machine / enum
ok('viewModel', 'RiveXVmToggle');
bad('viewModel', 'ToggleVM');
ok('stateMachine', 'RiveXSmHover');
bad('stateMachine', 'State Machine 1');
ok('enum', 'RiveXEnumTheme');
bad('enum', 'riveXEnumTheme'); // enum *type* is PascalCase

// instances
ok('instance', 'riveXInstanceVmDarkDefault');
ok('instance', 'riveXInstanceAbHome');
bad('instance', 'RiveXInstanceVmDark');
bad('instance', 'riveXInstanceXyz');

// vm properties / inputs
ok('vmProperty', 'riveXTriggerPlay');
ok('vmProperty', 'riveXBooleanIsDark');
ok('vmProperty', 'riveXBooleanHasBadge');
ok('input', 'riveXNumberProgress');
bad('vmProperty', 'riveXBooleanDark'); // boolean requires Is/Has
bad('input', 'isDark');
bad('input', 'Trigger 1');

// events / hit areas / timelines
ok('event', 'riveXEventOnComplete');
bad('event', 'riveXEventComplete');
ok('hitArea', 'riveXHitAreaButton');
bad('hitArea', 'hitButton');
ok('timeline', 'riveXTimelineIdle');
ok('timeline', 'riveXTimelineOnTap');
bad('timeline', 'idle_loop');

// unknown type → permissive; empty name → violation
assert.equal(validate('unknownType', 'whatever').ok, true);
assert.equal(validate('artboard', '').ok, false);
assert.equal(validate('artboard', null).ok, false);

// violations carry section refs pointing back to conventions.html
const v = validate('artboard', 'nope').violations[0];
assert.ok(v.message.length > 0 && v.section.length > 0);
assert.ok(Object.keys(RULES).length >= 13);

console.log('naming rules tests passed');
