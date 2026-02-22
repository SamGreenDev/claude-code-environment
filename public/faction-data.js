/**
 * Faction Data - Era & Faction System for the Holonet Command Center
 * Single source of truth for all faction/unit data across Star Wars eras
 */

(function () {
  'use strict';

  // ── Eras ──────────────────────────────────────────────────────────────────

  const ERAS = [
    { id: 'ot', label: 'Original Trilogy', lightFaction: 'rebel', darkFaction: 'empire' },
    { id: 'pt', label: 'Prequel Trilogy', lightFaction: 'republic', darkFaction: 'cis' },
    { id: 'st', label: 'Sequel Trilogy', lightFaction: 'resistance', darkFaction: 'first-order' },
  ];

  // ── Factions ──────────────────────────────────────────────────────────────

  const FACTIONS = {
    'rebel':       { name: 'Rebel Alliance',                     era: 'ot', side: 'light', icon: '⚔', accentColor: '#C74634' },
    'empire':      { name: 'Galactic Empire',                    era: 'ot', side: 'dark',  icon: '⬡', accentColor: '#555555' },
    'republic':    { name: 'Galactic Republic',                  era: 'pt', side: 'light', icon: '⚜', accentColor: '#4fa4ff' },
    'cis':         { name: 'Confederacy of Independent Systems', era: 'pt', side: 'dark',  icon: '⬢', accentColor: '#6B7280' },
    'resistance':  { name: 'The Resistance',                     era: 'st', side: 'light', icon: '✦', accentColor: '#E07A30' },
    'first-order': { name: 'The First Order',                    era: 'st', side: 'dark',  icon: '◆', accentColor: '#DC2626' },
  };

  // ── Unit Rosters ──────────────────────────────────────────────────────────
  // 9 units per faction, mapped to agent types

  const UNIT_ROSTER = {
    // ── Original Trilogy ──
    'rebel': [
      { type: 'architect',         unitClass: 'mon-cal-admiral',   label: 'Mon Calamari Admiral', color: '#4fa4ff', category: 'command' },
      { type: 'general-purpose',   unitClass: 'x-wing-pilot',     label: 'X-Wing Pilot',         color: '#50C878', category: 'starfighter' },
      { type: 'code-reviewer',     unitClass: 'rebel-honor-guard', label: 'Rebel Honor Guard',    color: '#E07A30', category: 'ground' },
      { type: 'security-reviewer', unitClass: 'bothan-spy',        label: 'Bothan Spy',           color: '#DC2626', category: 'intel' },
      { type: 'refactor-cleaner',  unitClass: 'r2-astromech',      label: 'R2 Astromech',         color: '#9CA3AF', category: 'droid' },
      { type: 'e2e-runner',        unitClass: 'a-wing-recon',      label: 'A-Wing Recon',         color: '#1B6B93', category: 'starfighter' },
      { type: 'Explore',           unitClass: 'pathfinder-scout',  label: 'Pathfinder Scout',     color: '#6B7280', category: 'ground' },
      { type: 'Plan',              unitClass: 'rebel-tactician',   label: 'Rebel Tactician',      color: '#2D6A4F', category: 'command' },
      { type: 'code-implementer', unitClass: 'rebel-engineer',    label: 'Rebel Engineer',       color: '#22D3EE', category: 'ground' },
    ],
    'empire': [
      { type: 'architect',         unitClass: 'imperial-strategist', label: 'Imperial Strategist', color: '#4fa4ff', category: 'command' },
      { type: 'general-purpose',   unitClass: 'tie-fighter-pilot',   label: 'TIE Fighter Pilot',   color: '#50C878', category: 'starfighter' },
      { type: 'code-reviewer',     unitClass: 'imperial-officer',    label: 'Imperial Officer',     color: '#E07A30', category: 'ground' },
      { type: 'security-reviewer', unitClass: 'isb-agent',           label: 'ISB Agent',            color: '#DC2626', category: 'intel' },
      { type: 'refactor-cleaner',  unitClass: 'mouse-droid',         label: 'Mouse Droid',          color: '#9CA3AF', category: 'droid' },
      { type: 'e2e-runner',        unitClass: 'tie-interceptor',     label: 'TIE Interceptor',      color: '#1B6B93', category: 'starfighter' },
      { type: 'Explore',           unitClass: 'probe-droid',         label: 'Probe Droid',          color: '#6B7280', category: 'droid' },
      { type: 'Plan',              unitClass: 'grand-moff',          label: 'Grand Moff',           color: '#2D6A4F', category: 'command' },
      { type: 'code-implementer', unitClass: 'imperial-engineer',  label: 'Imperial Engineer',    color: '#22D3EE', category: 'ground' },
    ],

    // ── Prequel Trilogy ──
    'republic': [
      { type: 'architect',         unitClass: 'jedi-general',      label: 'Jedi General',        color: '#4fa4ff', category: 'command' },
      { type: 'general-purpose',   unitClass: 'arc-170-pilot',     label: 'ARC-170 Pilot',       color: '#50C878', category: 'starfighter' },
      { type: 'code-reviewer',     unitClass: 'clone-commander',   label: 'Clone Commander',     color: '#E07A30', category: 'ground' },
      { type: 'security-reviewer', unitClass: 'senate-guard',      label: 'Senate Guard',        color: '#DC2626', category: 'intel' },
      { type: 'refactor-cleaner',  unitClass: 'r4-astromech',      label: 'R4 Astromech',        color: '#9CA3AF', category: 'droid' },
      { type: 'e2e-runner',        unitClass: 'v-wing-scout',      label: 'V-Wing Scout',        color: '#1B6B93', category: 'starfighter' },
      { type: 'Explore',           unitClass: 'clone-scout',       label: 'Clone Scout',         color: '#6B7280', category: 'ground' },
      { type: 'Plan',              unitClass: 'republic-strategist',label: 'Republic Strategist', color: '#2D6A4F', category: 'command' },
      { type: 'code-implementer', unitClass: 'clone-engineer',    label: 'Clone Engineer',      color: '#22D3EE', category: 'ground' },
    ],
    'cis': [
      { type: 'architect',         unitClass: 'tactical-droid',       label: 'Tactical Droid',       color: '#4fa4ff', category: 'droid' },
      { type: 'general-purpose',   unitClass: 'vulture-droid',        label: 'Vulture Droid',        color: '#50C878', category: 'starfighter' },
      { type: 'code-reviewer',     unitClass: 'magnaguard',           label: 'MagnaGuard',           color: '#E07A30', category: 'droid' },
      { type: 'security-reviewer', unitClass: 'geonosian-spy',        label: 'Geonosian Spy',        color: '#DC2626', category: 'intel' },
      { type: 'refactor-cleaner',  unitClass: 'dsd1-dwarf-spider',    label: 'DSD1 Dwarf Spider',    color: '#9CA3AF', category: 'droid' },
      { type: 'e2e-runner',        unitClass: 'hyena-bomber',          label: 'Hyena Bomber',         color: '#1B6B93', category: 'starfighter' },
      { type: 'Explore',           unitClass: 'buzz-droid',            label: 'Buzz Droid',           color: '#6B7280', category: 'droid' },
      { type: 'Plan',              unitClass: 'super-tactical-droid',  label: 'Super Tactical Droid', color: '#2D6A4F', category: 'command' },
      { type: 'code-implementer', unitClass: 'b1-engineer-droid',   label: 'B1 Engineer Droid',    color: '#22D3EE', category: 'droid' },
    ],

    // ── Sequel Trilogy ──
    'resistance': [
      { type: 'architect',         unitClass: 'resistance-admiral',   label: 'Resistance Admiral',   color: '#4fa4ff', category: 'command' },
      { type: 'general-purpose',   unitClass: 't70-xwing-pilot',      label: 'T-70 X-Wing Pilot',    color: '#50C878', category: 'starfighter' },
      { type: 'code-reviewer',     unitClass: 'resistance-officer',   label: 'Resistance Officer',   color: '#E07A30', category: 'ground' },
      { type: 'security-reviewer', unitClass: 'resistance-spy',       label: 'Resistance Spy',       color: '#DC2626', category: 'intel' },
      { type: 'refactor-cleaner',  unitClass: 'bb-astromech',         label: 'BB Astromech',         color: '#9CA3AF', category: 'droid' },
      { type: 'e2e-runner',        unitClass: 'rz2-awing',            label: 'RZ-2 A-Wing',         color: '#1B6B93', category: 'starfighter' },
      { type: 'Explore',           unitClass: 'resistance-scout',     label: 'Resistance Scout',     color: '#6B7280', category: 'ground' },
      { type: 'Plan',              unitClass: 'resistance-tactician', label: 'Resistance Tactician', color: '#2D6A4F', category: 'command' },
      { type: 'code-implementer', unitClass: 'resistance-engineer', label: 'Resistance Engineer', color: '#22D3EE', category: 'ground' },
    ],
    'first-order': [
      { type: 'architect',         unitClass: 'fo-strategist',         label: 'FO Strategist',          color: '#4fa4ff', category: 'command' },
      { type: 'general-purpose',   unitClass: 'tie-fo-pilot',          label: 'TIE/fo Pilot',           color: '#50C878', category: 'starfighter' },
      { type: 'code-reviewer',     unitClass: 'fo-captain',            label: 'FO Captain',             color: '#E07A30', category: 'ground' },
      { type: 'security-reviewer', unitClass: 'fo-security-bureau',    label: 'FO Security Bureau',     color: '#DC2626', category: 'intel' },
      { type: 'refactor-cleaner',  unitClass: 'fo-mouse-droid',        label: 'FO Mouse Droid',         color: '#9CA3AF', category: 'droid' },
      { type: 'e2e-runner',        unitClass: 'tie-sf-fighter',        label: 'TIE/sf Fighter',         color: '#1B6B93', category: 'starfighter' },
      { type: 'Explore',           unitClass: 'fo-recon-droid',        label: 'FO Recon Droid',         color: '#6B7280', category: 'droid' },
      { type: 'Plan',              unitClass: 'supreme-leaders-hand',  label: "Supreme Leader's Hand",  color: '#2D6A4F', category: 'command' },
      { type: 'code-implementer', unitClass: 'fo-engineer',           label: 'FO Engineer',            color: '#22D3EE', category: 'ground' },
    ],
  };

  // ── Helper Functions ──────────────────────────────────────────────────────

  const STORAGE_KEY = 'holonet-faction';

  function getUnitByType(factionId, agentType) {
    const roster = UNIT_ROSTER[factionId];
    if (!roster) return UNIT_ROSTER['rebel'][0];
    return roster.find(u => u.type === agentType) || roster[0];
  }

  function getCurrentFaction() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && stored.eraId && stored.side && FACTIONS[_resolveFactionId(stored.eraId, stored.side)]) {
        return {
          eraId: stored.eraId,
          side: stored.side,
          factionId: _resolveFactionId(stored.eraId, stored.side),
        };
      }
    } catch (_) { /* ignore */ }
    return { eraId: 'ot', side: 'light', factionId: 'rebel' };
  }

  function setCurrentFaction(eraId, side) {
    const factionId = _resolveFactionId(eraId, side);
    if (!FACTIONS[factionId]) return null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ eraId, side }));
    return { eraId, side, factionId };
  }

  function getUnitForCurrentFaction(agentType) {
    const { factionId } = getCurrentFaction();
    return getUnitByType(factionId, agentType);
  }

  function getFactionName(factionId) {
    const f = FACTIONS[factionId];
    return f ? f.name : 'Unknown';
  }

  function getFactionIcon(factionId) {
    const f = FACTIONS[factionId];
    return f ? f.icon : '?';
  }

  function _resolveFactionId(eraId, side) {
    const era = ERAS.find(e => e.id === eraId);
    if (!era) return 'rebel';
    return side === 'dark' ? era.darkFaction : era.lightFaction;
  }

  // ── Legacy Compat ─────────────────────────────────────────────────────────
  // Map old droidClass values to unitClass for backward compatibility

  function migrateDroidClass(droidClass) {
    const legacyMap = {
      'r2-series': 'r2-astromech',
      'bb-series': 'x-wing-pilot',
      'kx-series': 'rebel-honor-guard',
      'ig-series': 'r2-astromech',
      'probe-droid': 'a-wing-recon',
      'mouse-droid': 'pathfinder-scout',
    };
    return legacyMap[droidClass] || droidClass;
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  window.FactionData = {
    ERAS,
    FACTIONS,
    UNIT_ROSTER,
    getUnitByType,
    getCurrentFaction,
    setCurrentFaction,
    getUnitForCurrentFaction,
    getFactionName,
    getFactionIcon,
    migrateDroidClass,
  };

})();
