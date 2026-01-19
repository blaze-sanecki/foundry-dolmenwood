/* global foundry, game, Dialog, FilePicker, CONFIG, ui, Item, Roll, ChatMessage, CONST */
import { buildChoices, buildChoicesWithBlank, CHOICE_KEYS } from './utils/choices.js'

const TextEditor = foundry.applications.ux.TextEditor
const { HandlebarsApplicationMixin } = foundry.applications.api
const { ActorSheetV2 } = foundry.applications.sheets

class DolmenSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
	static DEFAULT_OPTIONS = {
		classes: ['dolmen', 'sheet', 'actor'],
		tag: 'form',
		form: {
			submitOnChange: true
		},
		position: {
			width: 880,
			height: 660,
		},
		window: {
			resizable: true,
			controls: [
				{
					action: 'configureActor',
					icon: 'fas fa-trees',
					label: 'DOLMEN.ConfigureSheet',
					ownership: 'OWNER'
				}
			]
		},
		actions: {
			addSkill: DolmenSheet._onAddSkill,
			removeSkill: DolmenSheet._onRemoveSkill,
			openItem: DolmenSheet._onOpenItem,
			equipItem: DolmenSheet._onEquipItem,
			stowItem: DolmenSheet._onStowItem,
			deleteItem: DolmenSheet._onDeleteItem,
			increaseQty: DolmenSheet._onIncreaseQty,
			decreaseQty: DolmenSheet._onDecreaseQty
		},
		dragDrop: [{ dropSelector: '.item-list' }]
	}

	static PARTS = {
		tabs: {
			template: 'systems/dolmenwood/templates/adventurer/parts/tab-nav.html'
		},
		stats: {
			template: 'systems/dolmenwood/templates/adventurer/parts/tab-stats.html',
			scrollable: ['.tab-stats']
		},
		inventory: {
			template: 'systems/dolmenwood/templates/adventurer/parts/tab-inventory.html',
			scrollable: ['.tab-inventory']
		},
		magic: {
			template: 'systems/dolmenwood/templates/adventurer/parts/tab-magic.html',
			scrollable: ['.tab-magic']
		},
		details: {
			template: 'systems/dolmenwood/templates/adventurer/parts/tab-details.html',
			scrollable: ['.tab-details']
		},
		notes: {
			template: 'systems/dolmenwood/templates/adventurer/parts/tab-notes.html',
			scrollable: ['.tab-notes']
		}
	}

	static TABS = {
		primary: {
			tabs: [
				{ id: 'stats', icon: 'fas fa-user', label: 'DOLMEN.Tabs.Stats' },
				{ id: 'inventory', icon: 'fas fa-backpack', label: 'DOLMEN.Tabs.Inventory' },
				{ id: 'magic', icon: 'fas fa-book-sparkles', label: 'DOLMEN.Tabs.Magic' },
				{ id: 'details', icon: 'fas fa-eye', label: 'DOLMEN.Tabs.Details' },
				{ id: 'notes', icon: 'fas fa-note-sticky', label: 'DOLMEN.Tabs.Notes' }
			],
			initial: 'stats'
		}
	}

	tabGroups = {
		primary: 'stats'
	}

	_getTabs() {
		const tabs = {}
		for (const [groupId, config] of Object.entries(this.constructor.TABS)) {
			const group = {}
			for (const t of config.tabs) {
				group[t.id] = {
					id: t.id,
					group: groupId,
					icon: t.icon,
					label: game.i18n.localize(t.label),
					active: this.tabGroups[groupId] === t.id,
					cssClass: this.tabGroups[groupId] === t.id ? 'active' : ''
				}
			}
			tabs[groupId] = group
		}
		return tabs
	}

	async _prepareContext(options) {
		const context = await super._prepareContext(options)

		// Add actor and system data
		context.actor = this.actor
		context.system = this.actor.system

		// Prepare tabs for the tabs part
		context.tabs = this._getTabs()

		// Prepare dropdown choices with localized labels
		context.kindredChoices = buildChoices('DOLMEN.Kindreds', CHOICE_KEYS.kindreds)
		context.classChoices = {
			...buildChoices('DOLMEN.Classes', CHOICE_KEYS.classes),
			...buildChoices('DOLMEN.Kindreds', CHOICE_KEYS.kindredClasses)
		}
		context.alignmentChoices = buildChoices('DOLMEN.Alignments', CHOICE_KEYS.alignments)
		context.encumbranceChoices = buildChoices('DOLMEN.Encumbrance', CHOICE_KEYS.encumbranceMethods)
		context.moonNameChoices = buildChoicesWithBlank('DOLMEN.MoonNames', CHOICE_KEYS.moonNames)
		context.moonPhaseChoices = buildChoicesWithBlank('DOLMEN.MoonPhases', CHOICE_KEYS.moonPhases)
		context.creatureTypeChoices = buildChoices('DOLMEN.CreatureTypes', CHOICE_KEYS.creatureTypes)
		context.creatureTypeLabel = game.i18n.localize(`DOLMEN.CreatureTypes.${this.actor.system.creatureType}`)

		// Max extra skills for template conditional
		context.maxExtraSkills = CONFIG.DOLMENWOOD.maxExtraSkills

		// Determine body/fur label based on kindred
		const furKindreds = ['breggle', 'grimalkin']
		const kindred = this.actor.system.kindred
		context.bodyLabel = furKindreds.includes(kindred)
			? game.i18n.localize('DOLMEN.ExtraDetails.Fur')
			: game.i18n.localize('DOLMEN.ExtraDetails.Body')

		// Prepare inventory items grouped by type
		const items = this.actor.items.contents.filter(i => i.type !== 'Spell')
		const equippedItems = items.filter(i => i.system.equipped).map(i => this._prepareItemData(i))
		const stowedItems = items.filter(i => !i.system.equipped).map(i => this._prepareItemData(i))

		// Group items by type
		context.equippedByType = this._groupItemsByType(equippedItems)
		context.stowedByType = this._groupItemsByType(stowedItems)
		context.hasEquippedItems = equippedItems.length > 0
		context.hasStowedItems = stowedItems.length > 0

		return context
	}

	/**
	 * Group items by their type for display.
	 * @param {object[]} items - Array of prepared item data
	 * @returns {object[]} Array of type groups with items
	 */
	_groupItemsByType(items) {
		const typeOrder = ['Weapon', 'Armor', 'Item', 'Treasure', 'Foraged']
		const groups = {}

		for (const item of items) {
			if (!groups[item.type]) {
				groups[item.type] = {
					type: item.type,
					typeLower: item.type.toLowerCase(),
					label: game.i18n.localize(`TYPES.Item.${item.type}`),
					items: [],
					isWeapon: item.type === 'Weapon',
					isArmor: item.type === 'Armor',
					isItem: item.type === 'Item',
					isTreasure: item.type === 'Treasure',
					isForaged: item.type === 'Foraged'
				}
			}
			groups[item.type].items.push(item)
		}

		// Sort groups by type order
		return typeOrder
			.filter(type => groups[type])
			.map(type => groups[type])
	}

	_getFaSymbol(quality, item){
		const ranges = `${item.system.rangeShort}/${item.system.rangeMedium}/${item.system.rangeLong}`
		const title = game.i18n.localize(`DOLMEN.Item.Quality.${quality}`)
		if (quality === "melee") return '<i class="fas fa-sword tooltip"><span class="tooltiptext">' + title + '</span></i>'
		if (quality === "missile") return '<i class="fas fa-bow-arrow tooltip"><span class="tooltiptext">'+title+' ('+ranges+')'+'</span></i>'
		if (quality === "armor-piercing") return '<i class="fas fa-bore-hole tooltip"><span class="tooltiptext">'+title+'</span></i>'
		if (quality === "brace") return '<i class="fas fa-shield-halved tooltip"><span class="tooltiptext">'+title+'</span></i>'
		if (quality === "reach") return '<i class="fas fa-arrows-left-right tooltip"><span class="tooltiptext">'+title+'</span></i>'
		if (quality === "reload") return '<i class="fas fa-arrows-rotate tooltip"><span class="tooltiptext">'+title+'</span></i>'
		if(quality === "two-handed") return '<i class="fas fa-handshake-angle tooltip"><span class="tooltiptext">'+title+'</span></i>'
		if (quality === "charge") return '<i class="fas fa-horse-saddle tooltip"><span class="tooltiptext">'+title+'</span></i>'
		if (quality === "splash") return '<i class="fas fa-droplet tooltip"><span class="tooltiptext">'+title+'</span></i>'
		if (quality === "cold-iron") return '<i class="fas fa-snowflake tooltip"><span class="tooltiptext">'+title+'</span></i>'
		if (quality === "silver") return '<i class="fas fa-star-christmas tooltip"><span class="tooltiptext">'+title+'</span></i>'
		return quality
	}

	/**
	 * Prepare item data for display in the inventory.
	 * @param {Item} item - The item to prepare
	 * @returns {object} Prepared item data
	 */
	_prepareItemData(item) {
		const data = {
			id: item.id,
			name: item.name,
			img: item.img,
			type: item.type,
			system: item.system,
			isWeapon: item.type === 'Weapon',
			isArmor: item.type === 'Armor',
			cssClass: item.type.toLowerCase(),
			hasNotes: (item.system?.notes || "") === "" ? false : true
		}

		// Add weapon qualities display
		if (data.isWeapon && item.system.qualities?.length) {
			data.qualitiesDisplay = item.system.qualities
				//.map(q => game.i18n.localize(`DOLMEN.Item.Quality.${q}`))
				.map(q => this._getFaSymbol(q, item))
				.join(', ')
		}
		// Add armor bulk display
		if (data.isArmor) {
			data.bulkDisplay = game.i18n.localize(`DOLMEN.Item.Bulk.${item.system.bulk}`)
			//data.faBulk = (item.system.bulk === 'light' ? 'fa-circle-quarter-stroke' : (item.system.bulk === 'medium' ? 'fa-circle-half-stroke' : 'fa-circle'))
		}

		return data
	}

	async _preparePartContext(partId, context) {
		context = await super._preparePartContext(partId, context)

		// For tab content parts, add the tab object
		const tabIds = ['stats', 'inventory', 'magic', 'details', 'notes']
		if (tabIds.includes(partId)) {
			context.tab = context.tabs?.primary?.[partId] || {
				id: partId,
				cssClass: this.tabGroups.primary === partId ? 'active' : ''
			}
		}

		return context
	}

	_onChangeTab(tabId, group) {
		this.tabGroups[group] = tabId
		this.render()
	}

	/* -------------------------------------------- */
	/*  Event Listener Setup                        */
	/* -------------------------------------------- */

	_onRender(context, options) {
		super._onRender(context, options)

		this._setupTabListeners()
		this._setupXPListener()
		this._setupPortraitPicker()
		this._setupSkillListeners()
		this._setupAttackListeners()
		this._setupUnitConversionListeners()
	}

	/**
	 * Setup tab navigation click listeners.
	 */
	_setupTabListeners() {
		this.element.querySelectorAll('.tabs .item').forEach(tab => {
			tab.addEventListener('click', (event) => {
				event.preventDefault()
				const { tab: tabId, group } = event.currentTarget.dataset
				this._onChangeTab(tabId, group)
			})
		})
	}

	/**
	 * Setup XP button click listener.
	 */
	_setupXPListener() {
		const xpBtn = this.element.querySelector('.xp-add-btn')
		if (xpBtn) {
			xpBtn.addEventListener('click', (event) => {
				event.preventDefault()
				this._openXPDialog()
			})
		}
	}

	/**
	 * Setup portrait image click for file picker.
	 */
	_setupPortraitPicker() {
		const portrait = this.element.querySelector('.portrait-image')
		if (portrait) {
			portrait.addEventListener('click', () => {
				new FilePicker({
					type: 'image',
					current: this.actor.img,
					callback: (path) => this.actor.update({ img: path })
				}).browse()
			})
		}
	}

	/**
	 * Setup add/remove skill button listeners.
	 */
	_setupSkillListeners() {
		const addSkillBtn = this.element.querySelector('.add-skill-btn')
		if (addSkillBtn) {
			addSkillBtn.addEventListener('click', (event) => {
				event.preventDefault()
				this._openAddSkillDialog()
			})
		}

		this.element.querySelectorAll('.remove-skill-btn').forEach(btn => {
			btn.addEventListener('click', (event) => {
				event.preventDefault()
				const index = parseInt(event.currentTarget.dataset.skillIndex)
				this._removeSkill(index)
			})
		})
	}

	/**
	 * Setup melee and missile attack icon listeners.
	 */
	_setupAttackListeners() {
		const attackButtons = [
			{ selector: '.fa-swords.rollable', type: 'melee' },
			{ selector: '.combat .fa-bow-arrow.rollable', type: 'missile' }
		]

		for (const { selector, type } of attackButtons) {
			const btn = this.element.querySelector(selector)
			if (btn) {
				btn.addEventListener('click', (event) => {
					event.preventDefault()
					this._onAttackRoll(type, event)
				})
				btn.addEventListener('contextmenu', (event) => {
					event.preventDefault()
					this._onAttackRollContextMenu(type, event)
				})
			}
		}
	}

	/**
	 * Setup height/weight unit conversion listeners.
	 */
	_setupUnitConversionListeners() {
		const heightFeetInput = this.element.querySelector('[data-convert="height-feet"]')
		const heightCmInput = this.element.querySelector('[data-convert="height-cm"]')
		const weightLbsInput = this.element.querySelector('[data-convert="weight-lbs"]')
		const weightKgInput = this.element.querySelector('[data-convert="weight-kg"]')

		// Height conversion: feet/inches <-> cm
		if (heightFeetInput && heightCmInput) {
			const updateCmFromFeetInches = () => {
				const fIndex = heightFeetInput.value.indexOf("'")
				const iIndex = heightFeetInput.value.indexOf('"')
				let feet = 0
				let inches = 0
				if(fIndex === -1 && iIndex === -1){
					feet = parseInt(heightFeetInput.value) || 0
				}
				if(fIndex > 0)
					feet = parseInt(heightFeetInput.value.substring(0, fIndex)) || 0
				if(iIndex > fIndex)
					inches = parseInt(heightFeetInput.value.substring(fIndex + 1, iIndex)) || 0
				const totalInches = feet * 12 + inches
				heightCmInput.value = Math.round(totalInches * 2.54)
			}

			const updateFeetInchesFromCm = () => {
				const cm = parseInt(heightCmInput.value) || 0
				const totalInches = Math.round(cm / 2.54)
				heightFeetInput.value = Math.floor(totalInches / 12) + "'" + (totalInches % 12) + '"'
			}

			heightFeetInput.addEventListener('change', updateCmFromFeetInches)
			heightCmInput.addEventListener('change', updateFeetInchesFromCm)
		}

		// Weight conversion: lbs <-> kg
		if (weightLbsInput && weightKgInput) {
			weightLbsInput.addEventListener('change', (event) => {
				const lbs = parseInt(event.target.value) || 0
				weightKgInput.value = Math.round(lbs * 0.453592)
			})
			weightKgInput.addEventListener('change', (event) => {
				const kg = parseInt(event.target.value) || 0
				weightLbsInput.value = Math.round(kg / 0.453592)
			})
		}
	}

	_openXPDialog() {
		const currentXP = this.actor.system.xp.value || 0
		const modifier = this.actor.system.xp.modifier || 0

		const content = `
			<div class="xp-modal-content">
				<div class="form-group">
					<label>${game.i18n.localize('DOLMEN.XPGained')}</label>
					<input type="number" id="xp-gained" value="0" min="0" autofocus>
				</div>
				<div class="form-group">
					<label>${game.i18n.localize('DOLMEN.XPBonus')}</label>
					<input type="number" id="xp-bonus" value="${modifier}">
					<span class="unit">%</span>
				</div>
				<div class="xp-calculation">
					<div>${game.i18n.localize('DOLMEN.XPCurrent')}: <strong>${currentXP}</strong></div>
					<div class="xp-total">${game.i18n.localize('DOLMEN.XPTotal')}: <span id="xp-total">${currentXP}</span></div>
				</div>
			</div>
		`

		const dialog = new Dialog({
			title: game.i18n.localize('DOLMEN.XPAddTitle'),
			content: content,
			buttons: {
				add: {
					icon: '<i class="fas fa-plus"></i>',
					label: game.i18n.localize('DOLMEN.XPAddButton'),
					callback: (html) => {
						const gained = parseInt(html.find('#xp-gained').val()) || 0
						const bonus = parseInt(html.find('#xp-bonus').val()) || 0
						const adjustedXP = Math.floor(gained * (1 + bonus / 100))
						const newXP = currentXP + adjustedXP
						this.actor.update({
							'system.xp.value': newXP,
							'system.xp.modifier': bonus
						})
					}
				},
				cancel: {
					icon: '<i class="fas fa-times"></i>',
					label: game.i18n.localize('DOLMEN.Cancel')
				}
			},
			default: 'add',
			render: (html) => {
				const gainedInput = html.find('#xp-gained')
				const bonusInput = html.find('#xp-bonus')
				const totalSpan = html.find('#xp-total')

				const updateTotal = () => {
					const gained = parseInt(gainedInput.val()) || 0
					const bonus = parseInt(bonusInput.val()) || 0
					const adjustedXP = Math.floor(gained * (1 + bonus / 100))
					totalSpan.text(currentXP + adjustedXP)
				}

				gainedInput.on('input', updateTotal)
				bonusInput.on('input', updateTotal)
			}
		})

		dialog.render(true)
	}

	_openAddSkillDialog() {
		const currentSkills = this.actor.system.extraSkills || []
		const currentSkillIds = currentSkills.map(s => s.id)
		const availableSkills = CONFIG.DOLMENWOOD.extraSkills.filter(id => !currentSkillIds.includes(id))

		if (availableSkills.length === 0 || currentSkills.length >= CONFIG.DOLMENWOOD.maxExtraSkills) {
			ui.notifications.warn(game.i18n.localize('DOLMEN.NoSkillsAvailable') || 'No more skills available to add.')
			return
		}

		const options = availableSkills.map(id => {
			const label = game.i18n.localize(`DOLMEN.Skills.${id}`)
			return `<option value="${id}">${label}</option>`
		}).join('')

		const content = `
			<div class="add-skill-modal">
				<div class="form-group">
					<label>${game.i18n.localize('DOLMEN.SelectSkill')}</label>
					<select id="skill-select">${options}</select>
				</div>
			</div>
		`

		const dialog = new Dialog({
			title: game.i18n.localize('DOLMEN.AddSkillTitle'),
			content: content,
			buttons: {
				add: {
					icon: '<i class="fas fa-plus"></i>',
					label: game.i18n.localize('DOLMEN.AddSkill'),
					callback: (html) => {
						const selectedSkill = html.find('#skill-select').val()
						this._addSkill(selectedSkill)
					}
				},
				cancel: {
					icon: '<i class="fas fa-times"></i>',
					label: game.i18n.localize('DOLMEN.Cancel')
				}
			},
			default: 'add'
		})

		dialog.render(true)
	}

	_addSkill(skillId) {
		const currentSkills = foundry.utils.deepClone(this.actor.system.extraSkills || [])
		currentSkills.push({ id: skillId, target: 6 })
		this.actor.update({ 'system.extraSkills': currentSkills })
	}

	_removeSkill(index) {
		const currentSkills = foundry.utils.deepClone(this.actor.system.extraSkills || [])
		currentSkills.splice(index, 1)
		this.actor.update({ 'system.extraSkills': currentSkills })
	}

	/* -------------------------------------------- */
	/*  Context Menu Utilities                      */
	/* -------------------------------------------- */

	/**
	 * Create and display a context menu.
	 * @param {object} config - Menu configuration
	 * @param {string} config.html - HTML content for the menu
	 * @param {object} config.position - Position {top, left}
	 * @param {Function} config.onItemClick - Callback when menu item clicked, receives (menuItem, menu)
	 * @param {Element} [config.excludeFromClose] - Element to exclude from close detection
	 * @returns {HTMLElement} The menu element
	 */
	_createContextMenu({ html, position, onItemClick, excludeFromClose = null }) {
		// Remove any existing context menu
		document.querySelector('.dolmen-weapon-context-menu')?.remove()

		// Create the menu element
		const menu = document.createElement('div')
		menu.className = 'dolmen-weapon-context-menu'
		menu.innerHTML = html

		// Position the menu
		menu.style.position = 'fixed'
		menu.style.top = `${position.top}px`
		menu.style.left = `${position.left}px`

		// Add to sheet
		this.element.appendChild(menu)

		// Adjust position after rendering (menu appears to left of click point)
		const menuRect = menu.getBoundingClientRect()
		menu.style.left = `${position.left - menuRect.width - 5}px`

		// Add click handlers to menu items
		menu.querySelectorAll('.weapon-menu-item').forEach(item => {
			item.addEventListener('click', () => onItemClick(item, menu))
		})

		// Close menu when clicking outside
		const closeMenu = (e) => {
			const clickedOutside = !menu.contains(e.target)
			const clickedExcluded = excludeFromClose && e.target === excludeFromClose
			if (clickedOutside && !clickedExcluded) {
				menu.remove()
				document.removeEventListener('click', closeMenu)
			}
		}
		setTimeout(() => document.addEventListener('click', closeMenu), 0)

		return menu
	}

	/**
	 * Build HTML for weapon selection menu items.
	 * @param {Item[]} weapons - Array of weapons
	 * @returns {string} HTML string
	 */
	_buildWeaponMenuHtml(weapons) {
		return weapons.map(w => `
			<div class="weapon-menu-item" data-weapon-id="${w.id}">
				<img src="${w.img}" alt="${w.name}" class="weapon-icon">
				<span class="weapon-name">${w.name}</span>
				<span class="weapon-damage">${w.system.damage}</span>
			</div>
		`).join('')
	}

	/* -------------------------------------------- */
	/*  Attack Roll Methods                         */
	/* -------------------------------------------- */

	/**
	 * Get equipped weapons that have a specific quality.
	 * @param {string} quality - The weapon quality to filter by ('melee' or 'missile')
	 * @returns {Item[]} Array of equipped weapons with the specified quality
	 */
	_getEquippedWeaponsByQuality(quality) {
		return this.actor.items.filter(item =>
			item.type === 'Weapon' &&
			item.system.equipped &&
			item.system.qualities?.includes(quality)
		)
	}

	/**
	 * Handle click on melee or missile attack icons.
	 * @param {string} attackType - Either 'melee' or 'missile'
	 * @param {Event} event - The click event
	 */
	_onAttackRoll(attackType, event) {
		const weapons = this._getEquippedWeaponsByQuality(attackType)

		if (weapons.length === 0) {
			const typeName = game.i18n.localize(`DOLMEN.Item.Quality.${attackType}`)
			ui.notifications.warn(game.i18n.format('DOLMEN.Attack.NoWeapon', { type: typeName }))
			return
		}

		if (weapons.length === 1) {
			this._rollAttack(weapons[0], attackType)
		} else {
			this._openWeaponContextMenu(weapons, attackType, event)
		}
	}

	/**
	 * Handle right-click on melee or missile attack icons.
	 * Opens a context menu to choose between attack-only or damage-only rolls.
	 * @param {string} attackType - Either 'melee' or 'missile'
	 * @param {Event} event - The contextmenu event
	 */
	_onAttackRollContextMenu(attackType, event) {
		const weapons = this._getEquippedWeaponsByQuality(attackType)

		if (weapons.length === 0) {
			const typeName = game.i18n.localize(`DOLMEN.Item.Quality.${attackType}`)
			ui.notifications.warn(game.i18n.format('DOLMEN.Attack.NoWeapon', { type: typeName }))
			return
		}

		// Store position from event before it becomes stale
		const iconRect = event.currentTarget.getBoundingClientRect()
		const position = { top: iconRect.top, left: iconRect.left }

		// Always show roll type menu first
		this._openRollTypeContextMenu(weapons, attackType, position)
	}

	/**
	 * Open a context menu to choose roll type (attack only or damage only).
	 * @param {Item[]} weapons - Array of weapons to potentially roll with
	 * @param {string} attackType - Either 'melee' or 'missile'
	 * @param {object} position - Position object with top and left properties
	 */
	_openRollTypeContextMenu(weapons, attackType, position) {
		const attackOnlyLabel = game.i18n.localize('DOLMEN.Attack.RollAttackOnly')
		const damageOnlyLabel = game.i18n.localize('DOLMEN.Attack.RollDamageOnly')

		const html = `
			<div class="weapon-menu-item" data-roll-type="attack">
				<i class="fas fa-dice-d20"></i>
				<span class="weapon-name">${attackOnlyLabel}</span>
			</div>
			<div class="weapon-menu-item" data-roll-type="damage">
				<i class="fas fa-burst"></i>
				<span class="weapon-name">${damageOnlyLabel}</span>
			</div>
		`

		this._createContextMenu({
			html,
			position,
			onItemClick: (item, menu) => {
				const rollType = item.dataset.rollType
				menu.remove()

				if (weapons.length === 1) {
					if (rollType === 'attack') {
						this._rollAttackOnly(weapons[0], attackType)
					} else if (rollType === 'damage') {
						this._rollDamageOnly(weapons[0], attackType)
					}
				} else {
					setTimeout(() => this._openWeaponSelectionMenu(weapons, attackType, rollType, position), 0)
				}
			}
		})
	}

	/**
	 * Open weapon selection menu after roll type has been chosen.
	 * @param {Item[]} weapons - Array of available weapons
	 * @param {string} attackType - Either 'melee' or 'missile'
	 * @param {string} rollType - Either 'attack' or 'damage'
	 * @param {object} position - Position object with top and left properties
	 */
	_openWeaponSelectionMenu(weapons, attackType, rollType, position) {
		this._createContextMenu({
			html: this._buildWeaponMenuHtml(weapons),
			position,
			onItemClick: (item, menu) => {
				const weapon = this.actor.items.get(item.dataset.weaponId)
				if (weapon) {
					if (rollType === 'attack') {
						this._rollAttackOnly(weapon, attackType)
					} else if (rollType === 'damage') {
						this._rollDamageOnly(weapon, attackType)
					}
				}
				menu.remove()
			}
		})
	}

	/**
	 * Open a context menu to select which weapon to attack with.
	 * @param {Item[]} weapons - Array of available weapons
	 * @param {string} attackType - Either 'melee' or 'missile'
	 * @param {Event} event - The click event for positioning
	 */
	_openWeaponContextMenu(weapons, attackType, event) {
		const iconRect = event.currentTarget.getBoundingClientRect()

		this._createContextMenu({
			html: this._buildWeaponMenuHtml(weapons),
			position: { top: iconRect.top, left: iconRect.left },
			excludeFromClose: event.currentTarget,
			onItemClick: (item, menu) => {
				const weapon = this.actor.items.get(item.dataset.weaponId)
				if (weapon) {
					this._rollAttack(weapon, attackType)
				}
				menu.remove()
			}
		})
	}

	/**
	 * Get attack modifiers for a given attack type.
	 * @param {string} attackType - Either 'melee' or 'missile'
	 * @returns {object} Object containing attackMod, abilityMod, and totalMod
	 */
	_getAttackModifiers(attackType) {
		const system = this.actor.system
		const attackMod = system.attack || 0
		const abilityMod = attackType === 'melee'
			? system.abilities.strength.mod
			: system.abilities.dexterity.mod
		return {
			attackMod,
			abilityMod,
			totalMod: attackMod + abilityMod
		}
	}

	/**
	 * Build the attack roll formula string.
	 * @param {number} totalMod - Total modifier to apply
	 * @returns {string} Roll formula like "1d20 + 3" or "1d20 - 1"
	 */
	_buildAttackFormula(totalMod) {
		return totalMod >= 0 ? `1d20 + ${totalMod}` : `1d20 - ${Math.abs(totalMod)}`
	}

	/**
	 * Get critical/fumble state from an attack roll.
	 * @param {Roll} attackRoll - The evaluated attack roll
	 * @returns {object} Object with resultClass and resultLabel
	 */
	_getAttackResultState(attackRoll) {
		const d20Result = attackRoll.dice[0].results[0].result
		if (d20Result === 20) {
			return {
				resultClass: 'critical',
				resultLabel: `<span class="roll-label">${game.i18n.localize('DOLMEN.Attack.Critical')}</span>`
			}
		} else if (d20Result === 1) {
			return {
				resultClass: 'fumble',
				resultLabel: `<span class="roll-label">${game.i18n.localize('DOLMEN.Attack.Fumble')}</span>`
			}
		}
		return { resultClass: '', resultLabel: '' }
	}

	/**
	 * Build chat message HTML for attack rolls.
	 * @param {object} config - Configuration object
	 * @param {Item} config.weapon - The weapon used
	 * @param {string} config.attackType - 'melee' or 'missile'
	 * @param {object} [config.attack] - Attack roll data (anchor, formula, resultClass, resultLabel)
	 * @param {object} [config.damage] - Damage roll data (anchor, formula)
	 * @returns {string} HTML content for the chat message
	 */
	_buildAttackChatHtml({ weapon, attackType, attack, damage }) {
		const attackTypeName = game.i18n.localize(`DOLMEN.Item.Quality.${attackType}`)

		let rollSections = ''
		if (attack) {
			rollSections += `
				<div class="roll-section attack-section ${attack.resultClass}">
					<label>${game.i18n.localize('DOLMEN.Attack.AttackRoll')}</label>
					<div class="roll-result">
						${attack.anchor.outerHTML}
						${attack.resultLabel}
					</div>
					<span class="roll-breakdown">${attack.formula}</span>
				</div>`
		}
		if (damage) {
			rollSections += `
				<div class="roll-section damage-section">
					<label>${game.i18n.localize('DOLMEN.Attack.DamageRoll')}</label>
					<div class="roll-result">
						${damage.anchor.outerHTML}
					</div>
					<span class="roll-breakdown">${damage.formula}</span>
				</div>`
		}

		return `
			<div class="dolmen attack-roll">
				<div class="attack-header">
					<img src="${weapon.img}" alt="${weapon.name}" class="weapon-icon">
					<div class="attack-info">
						<h3>${weapon.name}</h3>
						<span class="attack-type">${attackTypeName}</span>
					</div>
				</div>
				<div class="roll-results">${rollSections}</div>
			</div>
		`
	}

	/**
	 * Unified attack roll method supporting attack-only, damage-only, or both.
	 * @param {Item} weapon - The weapon to use
	 * @param {string} attackType - Either 'melee' or 'missile'
	 * @param {object} [options] - Roll options
	 * @param {boolean} [options.attackOnly=false] - Only roll attack (no damage)
	 * @param {boolean} [options.damageOnly=false] - Only roll damage (no attack)
	 */
	async _performAttackRoll(weapon, attackType, { attackOnly = false, damageOnly = false } = {}) {
		const rolls = []
		let attackData = null
		let damageData = null

		// Handle attack roll
		if (!damageOnly) {
			const { totalMod } = this._getAttackModifiers(attackType)
			const formula = this._buildAttackFormula(totalMod)
			const roll = new Roll(formula)
			await roll.evaluate()
			rolls.push(roll)

			const { resultClass, resultLabel } = this._getAttackResultState(roll)
			attackData = {
				anchor: await roll.toAnchor({ classes: ['attack-inline-roll'] }),
				formula,
				resultClass,
				resultLabel
			}
		}

		// Handle damage roll
		if (!attackOnly) {
			const roll = new Roll(weapon.system.damage)
			await roll.evaluate()
			rolls.push(roll)

			damageData = {
				anchor: await roll.toAnchor({ classes: ['damage-inline-roll'] }),
				formula: weapon.system.damage
			}
		}

		// Build and send chat message
		const chatContent = this._buildAttackChatHtml({
			weapon,
			attackType,
			attack: attackData,
			damage: damageData
		})

		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			content: chatContent,
			rolls,
			type: CONST.CHAT_MESSAGE_STYLES.OTHER
		})
	}

	/**
	 * Perform a full attack roll with a weapon (attack + damage).
	 * @param {Item} weapon - The weapon to attack with
	 * @param {string} attackType - Either 'melee' or 'missile'
	 */
	async _rollAttack(weapon, attackType) {
		return this._performAttackRoll(weapon, attackType)
	}

	/**
	 * Perform an attack roll only (no damage).
	 * @param {Item} weapon - The weapon to attack with
	 * @param {string} attackType - Either 'melee' or 'missile'
	 */
	async _rollAttackOnly(weapon, attackType) {
		return this._performAttackRoll(weapon, attackType, { attackOnly: true })
	}

	/**
	 * Perform a damage roll only (no attack).
	 * @param {Item} weapon - The weapon to roll damage for
	 * @param {string} attackType - Either 'melee' or 'missile'
	 */
	async _rollDamageOnly(weapon, attackType) {
		return this._performAttackRoll(weapon, attackType, { damageOnly: true })
	}

	static _onAddSkill(_event, _target) {
		this._openAddSkillDialog()
	}

	static _onRemoveSkill(_event, target) {
		const index = parseInt(target.dataset.skillIndex)
		this._removeSkill(index)
	}

	static _onOpenItem(_event, target) {
		const itemId = target.closest('[data-item-id]')?.dataset.itemId
		if (itemId) {
			const item = this.actor.items.get(itemId)
			item?.sheet.render(true)
		}
	}

	static async _onEquipItem(_event, target) {
		const itemId = target.dataset.itemId
		if (itemId) {
			const item = this.actor.items.get(itemId)
			await item?.update({ 'system.equipped': true })
		}
	}

	static async _onStowItem(_event, target) {
		const itemId = target.dataset.itemId
		if (itemId) {
			const item = this.actor.items.get(itemId)
			await item?.update({ 'system.equipped': false })
		}
	}

	static async _onDeleteItem(_event, target) {
		const itemId = target.dataset.itemId
		if (itemId) {
			const item = this.actor.items.get(itemId)
			if (item) {
				const confirmed = await Dialog.confirm({
					title: game.i18n.localize('DOLMEN.Inventory.DeleteConfirmTitle'),
					content: game.i18n.format('DOLMEN.Inventory.DeleteConfirmContent', { name: item.name })
				})
				if (confirmed) {
					await item.delete()
				}
			}
		}
	}

	static async _onIncreaseQty(_event, target) {
		const itemId = target.dataset.itemId
		if (itemId) {
			const item = this.actor.items.get(itemId)
			if (item) {
				const currentQty = item.system.quantity || 1
				await item.update({ 'system.quantity': currentQty + 1 })
			}
		}
	}

	static async _onDecreaseQty(_event, target) {
		const itemId = target.dataset.itemId
		if (itemId) {
			const item = this.actor.items.get(itemId)
			if (item) {
				const currentQty = item.system.quantity || 1
				if (currentQty > 1) {
					await item.update({ 'system.quantity': currentQty - 1 })
				}
			}
		}
	}

	async _onDrop(event) {
		const data = TextEditor.getDragEventData(event)

		// Handle item drops
		if (data.type === 'Item') {
			const targetList = event.target.closest('[data-item-list]')?.dataset.itemList
			const item = await Item.fromDropData(data)

			// If dropped from another actor or compendium, create a copy
			if (item.parent !== this.actor) {
				const itemData = item.toObject()
				itemData.system.equipped = targetList === 'equipped'
				await this.actor.createEmbeddedDocuments('Item', [itemData])
			} else {
				// If dropped within the same actor, toggle equipped state
				const equipped = targetList === 'equipped'
				if (item.system.equipped !== equipped) {
					await item.update({ 'system.equipped': equipped })
				}
			}
		}
	}
}

export default DolmenSheet
