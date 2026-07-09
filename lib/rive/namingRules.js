/**
 * Machine-checkable naming rules derived from conventions.html — that document
 * is the source of truth; each rule cites the section it encodes. Consumed by
 * the error badges in rive-section.js / app.js and by
 * scripts/test-naming-rules.mjs. If conventions.html changes, update RULES.
 *
 * validate(entityType, name) → { ok, violations: [{ message, section }] }
 */

export const RULES = {
  file: {
    // mds_rive_[type]_[product?]_[feature?]_[s{n}?]_[v{n}?].riv
    regex: /^mds_rive_[a-z0-9]+(?:_[a-z0-9]+)*$/,
    section: 'File naming',
    message: 'File names must be snake_case with the mds_rive_ prefix (mds_rive_[type]_[product]_[feature], optional _s{n}/_v{n})',
    normalize: (name) => String(name).replace(/\.riv$/i, ''),
  },
  icon: {
    regex: /^mds_ic_huge_[a-z0-9]+(?:_[a-z0-9]+)*$/,
    section: 'File naming',
    message: 'Icon names must be snake_case with the mds_ic_huge_ prefix',
  },
  illustration: {
    // mds_il_[type]_[name] — see illustration-conventions.html
    regex: /^mds_il_(?:hero|spot_hero|illustrated_icon)_[a-z0-9]+(?:_[a-z0-9]+)*$/,
    section: 'Illustration naming',
    message: 'Illustrations must be snake_case: mds_il_[hero|spot_hero|illustrated_icon]_[name]',
  },
  artboard: {
    regex: /^RiveXAb[A-Z][A-Za-z0-9]*$/,
    section: 'Artboards & Components',
    message: 'Artboards must be PascalCase: RiveXAb[AnimationType][IconOrIllustration]',
  },
  component: {
    regex: /^RiveXComp[A-Z][A-Za-z0-9]*$/,
    section: 'Artboards & Components',
    message: 'Components must be PascalCase: RiveXComp[Name]',
  },
  viewModel: {
    regex: /^RiveXVm[A-Z][A-Za-z0-9]*$/,
    section: 'View models & state machines',
    message: 'View Models must be PascalCase: RiveXVm[InteractionType]',
  },
  stateMachine: {
    regex: /^RiveXSm[A-Z][A-Za-z0-9]*$/,
    section: 'View models & state machines',
    message: 'State Machines must be PascalCase: RiveXSm[InteractionType]',
  },
  enum: {
    regex: /^RiveXEnum[A-Z][A-Za-z0-9]*$/,
    section: 'View models & state machines',
    message: 'Enums must be PascalCase: RiveXEnum[Name]',
  },
  instance: {
    regex: /^riveXInstance(?:Vm|Sm|Ab)[A-Z][A-Za-z0-9]*$/,
    section: 'Instances',
    message: 'Instances must be camelCase: riveXInstance[Vm|Sm|Ab][Source][Variant]',
  },
  // ViewModel properties and state machine inputs share the typed camelCase
  // scheme. Booleans additionally require an Is/Has prefix after the type.
  vmProperty: {
    regex: /^riveX(?:Trigger|Boolean(?:Is|Has)|Number|String|Color|Image|List|ViewModel|Enum)[A-Z][A-Za-z0-9]*$/,
    section: 'View model properties',
    message: 'Properties/inputs must be camelCase: riveX[Trigger|BooleanIs/Has…|Number|String|Color|Image|List|ViewModel|Enum][Name]',
  },
  event: {
    regex: /^riveXEventOn[A-Z][A-Za-z0-9]*$/,
    section: 'Events & hit areas',
    message: 'Events must be camelCase: riveXEventOn[Verb]',
  },
  hitArea: {
    regex: /^riveXHitArea[A-Z][A-Za-z0-9]*$/,
    section: 'Events & hit areas',
    message: 'Hit areas must be camelCase: riveXHitArea[Target]',
  },
  timeline: {
    regex: /^riveXTimeline(?:On)?[A-Z][A-Za-z0-9]*$/,
    section: 'Timelines',
    message: 'Timelines must be camelCase: riveXTimeline[State] or riveXTimelineOn[Verb]',
  },
};

// State machine inputs follow the same typed scheme as VM properties.
RULES.input = RULES.vmProperty;

export function validate(entityType, name) {
  const rule = RULES[entityType];
  const raw = String(name ?? '').trim();
  if (!rule) return { ok: true, violations: [] };
  if (!raw) {
    return { ok: false, violations: [{ message: 'Name is empty', section: rule.section }] };
  }
  const subject = rule.normalize ? rule.normalize(raw) : raw;
  if (rule.regex.test(subject)) return { ok: true, violations: [] };
  return { ok: false, violations: [{ message: rule.message, section: rule.section }] };
}
