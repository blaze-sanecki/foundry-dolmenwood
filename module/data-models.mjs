/* global foundry */
const { ArrayField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields

/* -------------------------------------------- */
/*  Schema Helper Functions                     */
/* -------------------------------------------- */

/**
 * Create an ability score field with score and modifier.
 * @returns {SchemaField} Ability score schema field
 */
function createAbilityField() {
	return new SchemaField({
		score: new NumberField({ required: true, integer: true, min: 3, max: 18, initial: 10 }),
		mod: new NumberField({ required: true, integer: true, min: -3, max: 3, initial: 0 })
	})
}

/**
 * Create a save target field.
 * @returns {NumberField} Save target field
 */
function createSaveField() {
	return new NumberField({ required: true, integer: true, min: 2, max: 19, initial: 10 })
}

/**
 * Create all save target fields.
 * @returns {SchemaField} Schema field containing all saves
 */
function createSavesSchema() {
	return new SchemaField({
		doom: createSaveField(),
		ray: createSaveField(),
		hold: createSaveField(),
		blast: createSaveField(),
		spell: createSaveField()
	})
}

/**
 * Create all ability score fields.
 * @returns {SchemaField} Schema field containing all abilities
 */
function createAbilitiesSchema() {
	return new SchemaField({
		strength: createAbilityField(),
		intelligence: createAbilityField(),
		wisdom: createAbilityField(),
		dexterity: createAbilityField(),
		constitution: createAbilityField(),
		charisma: createAbilityField()
	})
}

/* -------------------------------------------- */
/*  Actor Models                                */
/* -------------------------------------------- */

/**
 * Base data model for all actors (Adventurers and Creatures).
 * Contains statistics common to both actor types.
 */
class ActorDataModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			// Level - indicates power/danger level
			level: new NumberField({ required: true, integer: true, min: 1, initial: 1, max: 15 }),

			// Hit Points
			hp: new SchemaField({
				value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
				max: new NumberField({ required: true, integer: true, min: 1, initial: 10 })
			}),

			// Armour Class (base 10 unarmoured)
			ac: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),

			// Attack bonus
			attack: new NumberField({ required: true, integer: true, initial: 0 }),

			// Save Targets (lower is better)
			saves: createSavesSchema(),

			// Speed in feet per round
			speed: new NumberField({ required: true, integer: true, min: 0, initial: 40 }),

			// Size: small, medium, large
			size: new StringField({
				required: true,
				blank: false,
				initial: "medium",
				choices: ["small", "medium", "large"]
			}),

			// Alignment
			alignment: new StringField({
				required: true,
				blank: false,
				initial: "neutral",
				choices: ["lawful", "neutral", "chaotic"]
			}),
		}
	}
}

/**
 * Data model for Adventurer (player character) actors.
 */
export class AdventurerDataModel extends ActorDataModel {
	/**
	 * Calculate ability score modifier using Dolmenwood rules.
	 * @param {number} score - The ability score (3-18)
	 * @returns {number} The modifier (-3 to +3)
	 */
	static computeModifier(score) {
		if (score <= 3) return -3
		if (score <= 5) return -2
		if (score <= 8) return -1
		if (score <= 12) return 0
		if (score <= 15) return 1
		if (score <= 17) return 2
		return 3
	}

	/**
	 * Get creature type based on kindred.
	 * @param {string} kindred - The kindred (race)
	 * @returns {string} The creature type (fairy, demi-fey, or mortal)
	 */
	static getCreatureTypeForKindred(kindred) {
		const fairyKindreds = ['grimalkin', 'elf']
		const demiFeyKindreds = ['woodgrue']
		if (fairyKindreds.includes(kindred)) return 'fairy'
		if (demiFeyKindreds.includes(kindred)) return 'demi-fey'
		return 'mortal'
	}

	/** @override */
	prepareDerivedData() {
		// Calculate ability modifiers from scores
		for (const ability of Object.values(this.abilities)) {
			ability.mod = AdventurerDataModel.computeModifier(ability.score)
		}

		// Derive creature type from kindred
		this.creatureType = AdventurerDataModel.getCreatureTypeForKindred(this.kindred)
	}

	static defineSchema() {
		return {
			...super.defineSchema(),
			
			// Ability Scores (3-18, with modifiers)
			abilities: createAbilitiesSchema(),

			// Kindred (race)
			kindred: new StringField({
				required: true,
				blank: false,
				initial: "human",
				choices: ["breggle", "elf", "grimalkin", "human", "mossling", "woodgrue"]
			}),

			// Class
			class: new StringField({
				required: true,
				blank: false,
				initial: "fighter",
				choices: ["bard", "cleric", "enchanter", "fighter", "friar", "hunter", "knight", "magician", "thief", "breggle", "elf", "grimalkin", "mossling", "woodgrue"]
			}),

			// Experience Points
			xp: new SchemaField({
				value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				nextLevel: new NumberField({ required: true, integer: true, min: 0, initial: 2000 }),
				modifier: new NumberField({ required: true, integer: true, min: -20, max: 20, initial: 0 })
			}),

			// Magic Resistance (from Wisdom and Kindred)
			magicResistance: new NumberField({ required: true, integer: true, initial: 0 }),

			// Movement speeds
			movement: new SchemaField({
				exploring: new NumberField({ required: true, integer: true, min: 0, initial: 120 }), // feet per turn
				overland: new NumberField({ required: true, integer: true, min: 0, initial: 24 }) // travel points per day
			}),

			// Skill Targets (roll d6, meet or exceed target)
			skills: new SchemaField({
				listen: new NumberField({ required: true, integer: true, min: 2, max: 6, initial: 6 }),
				search: new NumberField({ required: true, integer: true, min: 2, max: 6, initial: 6 }),
				survival: new NumberField({ required: true, integer: true, min: 2, max: 6, initial: 6 })
			}),

			// Extra skills (class-specific or acquired)
			extraSkills: new ArrayField(new SchemaField({
				id: new StringField({ required: true, blank: false }),
				target: new NumberField({ required: true, integer: true, min: 2, max: 6, initial: 6 })
			}), { initial: [] }),

			// Background (narrative, no mechanical effect)
			background: new SchemaField({
				profession: new StringField({ required: true, blank: true }),
				notes: new HTMLField({ required: true, blank: true })
			}),

			// Affiliation
			affiliation: new StringField({ required: true, blank: true }),

			// Moon Sign
			moonName: new StringField({
				required: true,
				blank: false,
				initial: "none",
				choices: ["none", "grinning", "dead", "beast", "squamous", "knights", "rotting", "maidens", "witch", "robbers", "goat", "narrow", "black"]
			}),
			moonPhase: new StringField({
				required: true,
				blank: false,
				initial: "none",
				choices: ["none", "waxing", "full", "waning"]
			}),

			// Languages
			languages: new ArrayField(new StringField({ blank: false }), { initial: ["woldish"] }),

			// Encumbrance
			encumbrance: new SchemaField({
				method: new StringField({
					required: true,
					blank: false,
					initial: "weight",
					choices: ["weight", "treasure", "slots"]
				}),
				current: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				max: new NumberField({ required: true, integer: true, min: 0, initial: 40 })
			}),

			// Coins
			coins: new SchemaField({
				copper: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				silver: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				gold: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				pellucidium: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
			}),

			// Creature type (relevant for spells/effects/etc.)
			creatureType: new StringField({
				required: true,
				blank: false,
				initial: "mortal",
				choices: [
					"demi-fey", "fairy", "mortal"
				]
			}),

			// Character details (appearance and personality)
			details: new SchemaField({
				head: new StringField({ required: true, blank: true }),
				demeanour: new StringField({ required: true, blank: true }),
				desires: new StringField({ required: true, blank: true }),
				face: new StringField({ required: true, blank: true }),
				dress: new StringField({ required: true, blank: true }),
				beliefs: new StringField({ required: true, blank: true }),
				body: new StringField({ required: true, blank: true }),
				speech: new StringField({ required: true, blank: true })
			}),

			// Physical characteristics
			physical: new SchemaField({
				unitSystem: new StringField({
					required: true,
					blank: false,
					initial: "imperial",
					choices: ["imperial", "metric"]
				}),
				age: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				lifespan: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				heightFeet: new StringField({ required: true, blank: true, initial: "0'0\"" }),
				heightCm: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				weightLbs: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				weightKg: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
			})
		}
	}
}

/**
 * Data model for Creature (monster/NPC) actors.
 */
export class CreatureDataModel extends ActorDataModel {
	static defineSchema() {
		return {
			...super.defineSchema(),

			// Intelligence level
			intelligence: new StringField({
				required: true,
				blank: false,
				initial: "animal",
				choices: ["mindless", "animal", "semi-intelligent", "sentient", "genius"]
			}),

			// HP dice (e.g., "2d8")
			hpDice: new StringField({ required: true, blank: false, initial: "1d8" }),

			// Morale (2-12, checked with 2d6)
			morale: new NumberField({ required: true, integer: true, min: 2, max: 12, initial: 7 }),

			// XP Award for defeating
			xpAward: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),

			// Number encountered (dice string, e.g., "1d6")
			encounters: new StringField({ required: true, blank: true, initial: "1d6" }),

			// Additional movement types
			movement: new SchemaField({
				swim: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				fly: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				climb: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				burrow: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
			}),
			// Lair percentage (chance creature is in lair)
			lairChance: new NumberField({ required: true, integer: true, min: 0, max: 100, initial: 0 }),

			// Treasure/Hoard type
			treasureType: new StringField({ required: true, blank: true }),

			// Description / lore
			description: new HTMLField({ required: true, blank: true }),

		}
	}
}

/* -------------------------------------------- */
/*  Item Models                                 */
/* -------------------------------------------- */

export class ItemDataModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			cost: new NumberField({
				required: true,
				integer: true,
				min: 0,
				initial: 0 }),
			weightSlots: new NumberField({
				required: true,
				min: 0,
				initial: 0 }),
			weightCoins: new NumberField({
				required: true,
				min: 0,
				initial: 0 }),
			equipped: new foundry.data.fields.BooleanField({
				required: true,
				initial: false
			}),
			quantity: new NumberField({
				required: true,
				integer: true,
				min: 1,
				initial: 1 }),
			notes: new StringField({
				required: true,
				blank: true,
				initial: ""
			})
		}
	}
}

export class TreasureDataModel extends ItemDataModel {}

export class WeaponDataModel extends ItemDataModel {
	static defineSchema() {
		return {
			...super.defineSchema(),
			damage: new StringField({ 
				required: true, 
				blank: false, 
				initial: "1d6" 
			}),
			size: new StringField({
				required: true,
				blank: false,
				initial: "medium",
				choices: ["small", "medium", "large"]
			}),
			qualities: new ArrayField(
				new StringField({ 
					blank: false, 
					choices: ["armor-piercing", "brace", "charge", "melee", "missile", "reach", "reload", "splash", "two-handed", "cold-iron", "silver"]
				}), 
				{ initial: ["melee"] }),
			rangeShort: new NumberField({ 
				required: false, 
				integer: true,
				min: 0,
				initial: 0
			}),
			rangeMedium: new NumberField({ 
				required: false, 
				integer: true,
				min: 0,
				initial: 0
			}),
			rangeLong: new NumberField({ 
				required: false, 
				integer: true,
				min: 0,
				initial: 0
			})
		}
	}
}

export class ArmorDataModel extends ItemDataModel {
	static defineSchema() {
		return {
			...super.defineSchema(),
			bulk: new StringField({
				required: true,
				blank: false,
				initial: "light",
				choices: ["none", "light", "medium", "heavy"]
			}),
			ac: new NumberField({ 
				required: true, 
				integer: true,
				initial: 10
			}),
			fit: new StringField({
				required: true,
				blank: false,
				initial: "medium",
				choices: ["small", "medium", "large"]
			}),
		}
	}
}

export class ForagedDataModel extends ItemDataModel {
	static defineSchema() {
		return {
			...super.defineSchema(),
			type: new StringField({
				required: true,
				blank: false,
				initial: "plant",
				choices: ["plant", "fungus", "pipeleaf"]
			}),
			availability: new NumberField({
				required: true,
				integer: true,
				initial: 6,
				min: 1,
				max: 6
			})
		}
	}
}

export class SpellDataModel extends ItemDataModel {
	static defineSchema() {
		return {
			...super.defineSchema(),
			type: new StringField({
				required: true,
				blank: false,
				initial: "glamour",
				choices: ["arcane", "glamour", "rune", "holy", "knack"]
			})
		}
	}
}
