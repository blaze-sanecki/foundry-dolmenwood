/* global game */

/**
 * Utility functions for building localized choice objects for dropdowns and selects.
 */

/**
 * Build a choice object from an array of keys and a localization namespace.
 * @param {string} namespace - The localization namespace (e.g., 'DOLMEN.Kindreds')
 * @param {string[]} keys - Array of choice keys
 * @returns {Object} Object mapping keys to localized labels
 */
export function buildChoices(namespace, keys) {
	const choices = {}
	for (const key of keys) {
		choices[key] = game.i18n.localize(`${namespace}.${key}`)
	}
	return choices
}

/**
 * Build a choice object with a blank/none option at the start.
 * @param {string} namespace - The localization namespace
 * @param {string[]} keys - Array of choice keys
 * @param {string} blankLabel - Label for the blank option (default: " ")
 * @returns {Object} Object mapping keys to localized labels with blank option
 */
export function buildChoicesWithBlank(namespace, keys, blankLabel = " ") {
	return {
		none: blankLabel,
		...buildChoices(namespace, keys)
	}
}

/**
 * Build quality options for weapon checkboxes.
 * @param {string[]} currentQualities - Array of currently selected quality IDs
 * @returns {Object[]} Array of quality option objects with checked state
 */
export function buildQualityOptions(currentQualities = []) {
	const qualityIds = [
		'armor-piercing', 'brace', 'charge', 'melee', 'missile',
		'reach', 'reload', 'splash', 'two-handed', 'cold-iron', 'silver'
	]
	return qualityIds.map(id => ({
		id,
		label: game.i18n.localize(`DOLMEN.Item.Quality.${id}`),
		checked: currentQualities.includes(id)
	}))
}

// Pre-defined choice key arrays for common dropdowns
export const CHOICE_KEYS = {
	kindreds: ['breggle', 'elf', 'grimalkin', 'human', 'mossling', 'woodgrue'],
	classes: ['bard', 'cleric', 'enchanter', 'fighter', 'friar', 'hunter', 'knight', 'magician', 'thief'],
	// Classes that can also be kindreds (for the class dropdown)
	kindredClasses: ['breggle', 'elf', 'grimalkin', 'mossling', 'woodgrue'],
	alignments: ['lawful', 'neutral', 'chaotic'],
	encumbranceMethods: ['weight', 'treasure', 'slots'],
	moonNames: ['grinning', 'dead', 'beast', 'squamous', 'knights', 'rotting', 'maidens', 'witch', 'robbers', 'goat', 'narrow', 'black'],
	moonPhases: ['waxing', 'full', 'waning'],
	creatureTypes: ['mortal', 'demi-fey', 'fairy'],
	sizes: ['small', 'medium', 'large'],
	armorBulks: ['none', 'light', 'medium', 'heavy'],
	foragedTypes: ['plant', 'fungus', 'pipeleaf'],
	spellTypes: ['arcane', 'glamour', 'rune', 'holy', 'knack']
}
