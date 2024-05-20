import React from 'react';
import {diceRoll, deepCopy} from './Utils';
import ItemTypes from './data/itemTypes.json';
import WeaponTypes from './data/weaponTypes.json';
import Skills from './data/skills.json';

class Character extends React.Component {
	constructor(props) {
		super(props);

		this.noGunKnowledgePenalty = 0.5;
		this.hitDie = 10;
		this.damageDie = 6;
		this.defenseDie = 4;

		// For instantiation only - updated data is stored in App.state.playerCharacters
		this.id = props.id;
		this.name = props.name;
		this.gender = props.gender;
		this.type = props.type;
		this.profession = props.profession;
		this.level = 1;
		this.xp = 0;
		this.strength = props.strength;
		this.agility = props.agility;
		this.mentalAcuity = props.mentalAcuity;
		this.initiative = this._calculateInitiative();
		this.startingHealth = props.startingHealth;
		this.currentHealth = props.startingHealth;
		this.turnsSinceDeath = 0;
		this.isDeadOrInsane = false;
		this.startingSanity = props.startingSanity;
		this.currentSanity = props.startingSanity;
		this.startingSpirit = (this.startingHealth / 2) + (this.startingSanity / 2);
		this.currentSpirit = (this.startingHealth / 2) + (this.startingSanity / 2);
		this.skills = this._copySkillData(props.skills);
		this.inventory = this._prePopulateInv(props.playerInventoryLimit);
		this.weapons = this._populateInvInfo('weapon', props.weapons, props.equippedItems);
		this.equippedItems = {
			loadout1: {right: props.equippedItems.right, left: this._weaponIsTwoHanded(props.equippedItems.right) ? props.equippedItems.right : props.equippedItems.left},
			loadout2: {right: '', left: ''},
			armor: props.equippedItems.armor || ''
		};
		this.items = this._populateInvInfo('item', props.items, props.equippedItems);
		this.maxItems = 12;
		this.defense = this.calculateDefense(props.agility, props.equippedItems.armor ? this.items[props.equippedItems.armor].defense : 0);
		this.damageReduction = this.equippedItems.armor ? this.items[this.equippedItems.armor].damageReduction : 0;
		this.coords = {};
		this.equippedLight = props.equippedLight || null;
		this.lightRange = this.equippedLight ? this.items[this.equippedLight].range : 0;
		this.lightTime = this.equippedLight ? this.items[this.equippedLight].time : null;
		this.statuses = {};
	}

	_prePopulateInv(invLimit) {
		// need to initially fill in inv slots with null, so char info panel shows empty boxes
		let inv = [];
		for(let i = 0; i < invLimit; i++) {
			inv.push(null);
		}
		return inv;
	}

	_populateInvInfo(type, objects, equipped) {
		const fullItemData = type === 'weapon' ? WeaponTypes : ItemTypes;
		let allInfo = {};
		for (const [id, info] of Object.entries(objects)) {
			allInfo[id] = {...info, ...fullItemData[info.name]};
			if (id !== equipped.right && id !== equipped.left && id !== equipped.armor) {
				const firstEmptyBoxId = this.inventory.indexOf(null);
				this.inventory.splice(firstEmptyBoxId, 1, id);
			}
		}
		return allInfo;
	}

	_calculateInitiative() {
		return this.mentalAcuity + this.agility;
	}

	_copySkillData(charSkills) {
		let skillData = {};
		charSkills.forEach(skillId => {
			skillData[skillId] = {...Skills[skillId], level: 0};
		});
		return skillData;
	}

	_weaponIsTwoHanded(weapon) {
		return this.weapons[weapon] && WeaponTypes[this.weapons[weapon].name].twoHanded;
	}

	/* PUBLIC */

	calculateDefense = (agility, armor) => {
		return agility + armor;
	}

	/**
	 * Carry out an attack on a creature
	 * @param props : object (
	 *  itemId: string,
	 *  itemStats: object,
	 *  targetData: object,
	 *  pcData: object,
	 *  updateCharacter: function (from App),
	 *  updateLog: function (from App),
	 *  callback: function (from App - calls toggleWeapon, _removeDeadFromTurnOrder if creature dies, then _updateActivePlayerActions)
	 * )
	 */
	attack = (props) => {
		const {itemId, itemStats, targetData, pcData, updateCharacter, updateLog, callback} = props;
		let isHit, damageTotal, attackTotal, defenseTotal;
		let rangedStrHitModifier = itemStats.usesStr ? Math.round(pcData.strength / 2) : 0;
		let updatedPcData = deepCopy(pcData);
		let updatedCreatureData = deepCopy(targetData);
		const weaponInfo = updatedPcData.weapons[itemId];
		const equippedSide = pcData.equippedItems.loadout1.right === itemId ? 'right' : 'left';
		const equippedGunType = weaponInfo.gunType;
		const noGunKnowledgeMod =
			(!pcData.skills.handgunKnowledge && equippedGunType === 'handgun') ||
			(!pcData.skills.shotgunKnowledge && equippedGunType === 'shotgun') ||
			(!pcData.skills.machineGunKnowledge && equippedGunType === 'machineGun') ? this.noGunKnowledgePenalty : 1;
		const hitRoll = diceRoll(this.hitDie);
		const damageRoll = diceRoll(this.damageDie);
		const defenseRoll = diceRoll(this.defenseDie);

		if (itemStats.ranged) {
			const sureShotSkill = pcData.skills.sureShot;
			const sureShotBonus = sureShotSkill && equippedGunType ? sureShotSkill.modifier[sureShotSkill.level] : 0;
			const steadyHandSkill = pcData.skills.steadyHand;
			const steadyHandBonus = steadyHandSkill && equippedGunType === 'handgun' ? steadyHandSkill.modifier[steadyHandSkill.level] : 0;
			attackTotal = Math.round(noGunKnowledgeMod * (pcData.agility + steadyHandBonus + sureShotBonus + rangedStrHitModifier + hitRoll));
			damageTotal = rangedStrHitModifier + itemStats.damage + damageRoll - targetData.damageReduction;
			weaponInfo.currentRounds--;
			if (weaponInfo.currentRounds === 0 && weaponInfo.stackable) {
				delete updatedPcData.weapons[itemId];
				updatedPcData.equippedItems.loadout1[equippedSide] = '';
			}
		} else {
			attackTotal = pcData.strength + Math.round(pcData.agility / 2) + hitRoll;
			damageTotal = pcData.strength + itemStats.damage + damageRoll - targetData.damageReduction;
		}
		damageTotal = damageTotal < 0 ? 0 : damageTotal;
		defenseTotal = targetData.defense + defenseRoll;
		isHit = attackTotal >= defenseTotal;
		updateLog(`${pcData.name} attacks with a ${weaponInfo.name} and rolls ${attackTotal} to hit...`);
		updateCharacter('player', updatedPcData, pcData.id, false, false, false, () => {
			if (isHit) {
				updatedCreatureData.currentHealth -= damageTotal;
				updateCharacter('creature', updatedCreatureData, targetData.id, false, false, false, callback);
			} else if (callback) {
				callback();
			}
		});
		updateLog(isHit ? `${pcData.name} hits for ${damageTotal} damage!` : pcData.name + ' misses.');
	}

	/**
	 * Carry out a health or sanity heal on a companion
	 * @param props : object (
	 *  itemId: string,
	 *  itemStats: object,
	 *  targetData: object,
	 *  pcData: object,
	 *  updateCharacter: function (from App),
	 *  updateLog: function (from App),
	 *  isChemistSkill: boolean (used for betterLivingThroughChemicals skill)
	 *  callback: function (from App - calls toggleWeapon, _removeDeadFromTurnOrder if creature dies, then _updateActivePlayerActions)
	 * )
	 */
	heal = (props) => {
		const {itemId, itemStats, targetData, pcData, updateCharacter, updateLog, isChemistSkill, callback} = props;
		const healItem = pcData.items[itemId].name;
		const targetStat = itemStats.healingType === 'health' ? 'currentHealth' : 'currentSanity';
		const startingStatValue = itemStats.healingType === 'health' ? targetData.startingHealth : targetData.startingSanity;
		let healAmount = Math.round(pcData.mentalAcuity / 2) + (itemStats.healingType === 'health' ? diceRoll(12) : diceRoll(4)) + itemStats.healingAmount;
		let updatedHealerData = deepCopy(pcData);
		// if pc is healing itself, target points to healer object
		let updatedTargetData = targetData.id !== pcData.id ? deepCopy(targetData) : updatedHealerData;
		const medicalExpertSkill = updatedHealerData.skills.medicalExpertise;

		if (medicalExpertSkill) {
			healAmount += medicalExpertSkill.modifier[medicalExpertSkill.level];
		}
		if (isChemistSkill) {
			const skillData = pcData.skills.betterLivingThroughChemicals;
			healAmount += skillData.modifier[skillData.level] * healAmount;
			updatedHealerData.currentSpirit -= skillData.spirit[skillData.level];
		}

		const healedStatValue = targetData[targetStat] + healAmount;
		updatedTargetData[targetStat] = healedStatValue > startingStatValue ? startingStatValue : healedStatValue;
		if (updatedHealerData.items[itemId].amount === 1) {
			delete updatedHealerData.items[itemId];
			const itemInvIndex = updatedHealerData.inventory.indexOf(itemId);
			updatedHealerData.inventory.splice(itemInvIndex, 1, null);
		} else {
			updatedHealerData.items[itemId].amount--;
		}
		updateCharacter('player', updatedTargetData, targetData.id, false, false, false, () => {
			const target = pcData.name === targetData.name ? (targetData.gender === 'Male' ? 'his' : 'her') : targetData.name + "'s";
			updateLog(`${pcData.name} uses ${healItem} to recover ${target} ${targetStat.substring(7)}`);
			if (targetData.id !== pcData.id) {
				updateCharacter('player', updatedHealerData, pcData.id, false, false, false, callback);
			} else {
				callback();
			}
		});
	}

	/** Profession Skills **/

	/**
	 * Creates an item using materials and light (cost); enemies must not be around in order to use
	 * Called from toggleActionButton in App
	 * @param props: object {
	 *     itemType: string ('firstAidKit', 'molotovCocktail', 'torch', 'acidConcoction', 'pharmaceuticals', 'holyWater'),
	 *     activeCharId: string,
	 *     currentPcData: object,
	 *     updateCharacter: function (from App),
	 *     updateLog: function (from App),
	 *     setShowDialogProps: function (from App),
	 *     addItemToPlayerInventory: function (from App),
	 *     updateActivePlayerActions: function (from App)
	 * }
	 */
	create = (props) => {
		const {itemType, activeCharId, currentPcData, updateCharacter, updateLog, setShowDialogProps, addItemToPlayerInventory, updateActivePlayerActions} = props;
		const materialCosts = currentPcData.skills[itemType].cost;
		const lightCost = currentPcData.skills[itemType].light[0];
		const itemName = currentPcData.skills[itemType].name;
		let updatedPcData = deepCopy(currentPcData);
		let activeCharItems = updatedPcData.items;
		const notEnoughMatsDialogProps = {
			dialogContent: "That character doesn't have enough materials to create that item.",
			closeButtonText: 'Ok',
			closeButtonCallback: null,
			disableCloseButton: false,
			actionButtonVisible: false,
			actionButtonText: '',
			actionButtonCallback: null,
			dialogClasses: ''
		};
		for (const [material, reqAmount] of Object.entries(materialCosts)) {
			// need to remove the 0 in the inventory item key
			const materialItemKey = material + '0';
			// if not enough materials to create, show dialog and exit
			if (!currentPcData.items[materialItemKey] || currentPcData.items[materialItemKey].amount < reqAmount) {
				setShowDialogProps(true, notEnoughMatsDialogProps);
				return;
			// otherwise, delete materials from inv
			} else {
				activeCharItems[materialItemKey].amount -= reqAmount;
				if (activeCharItems[materialItemKey].amount === 0) {
					delete activeCharItems[materialItemKey];
					const materialInvIndex = updatedPcData.inventory.indexOf(materialItemKey);
					updatedPcData.inventory.splice(materialInvIndex, 1, null);
				}
			}
		}
		if (updatedPcData.equippedLight) {
			const timeSpent = lightCost > updatedPcData.lightTime ? updatedPcData.lightTime : lightCost;
			const equippedLight = updatedPcData.equippedLight;
			updatedPcData.items[equippedLight].time -= timeSpent;
			updatedPcData.lightTime -= timeSpent;
		}

		let itemId = itemType + '0';
		const itemCategory = currentPcData.skills[itemType].itemCategory;
		let itemData = {};
		if (itemCategory === 'items') {
			itemData = {...ItemTypes[itemName]};
		} else if (itemCategory === 'weapons') {
			itemData = {...WeaponTypes[itemName]};
		}
		if ((updatedPcData.items[itemId] || updatedPcData.weapons[itemId]) && itemData.stackable) {
			if (itemCategory === 'items') {
				updatedPcData.items[itemId].amount++;
			} else if (itemCategory === 'weapons') {
				updatedPcData.weapons[itemId].currentRounds++;
			}
		}

		updateLog(`${currentPcData.name} creates a${itemType === 'acidConcoction' ? 'n' : ''} ${itemName}.`);
		// update stackable counts if applicable and remove used materials
		updateCharacter('player', updatedPcData, activeCharId, false, false, false, () => {
			// if item is new (not stackable or is stackable but id not in items/weapons), add to items/weapons and inventory
			if (!itemData.stackable || (!updatedPcData.items[itemId] && !updatedPcData.weapons[itemId])) {
				// For stackable items (5 of the 6 items currently), ID will be coerced to 0 in App.addItemToPlayerInventory, so loop below isn't needed
				// but if other nonstackable item create skills are added, then this loop will be needed for those
				let greatestItemNumInInv = 0;
				if (itemType === 'torch') {
					for (const itemId of Object.keys(currentPcData[itemCategory])) {
						if (itemId.includes(itemType)) {
							const currentItemIdNum = +itemId.substring(itemType.length - 1);
							if (currentItemIdNum >= greatestItemNumInInv) {
								greatestItemNumInInv = currentItemIdNum + 1;
							}
						}
					}
				}
				itemId = itemType + greatestItemNumInInv;
				if (itemData.stackable) {
					if (itemCategory === 'items') {
						itemData.amount = 1;
					} else if (itemCategory === 'weapons') {
						itemData.currentRounds = 1;
					}
				}
				itemData.name = itemName;
				itemData.id = itemId;
				// now add item to items/weapons and inv
				addItemToPlayerInventory(itemData, itemId, activeCharId, false, true);
			// otherwise, not new item (stacked item and count was already updated), so just update actions
			} else {
				updateActivePlayerActions();
			}
		});
	}

	/**
	 *
	 * @param props: object {
	 *
	 * }
	 */
	dig = (props) => {

	}

	/**
	 * Skill (Chemist): enhance sanity healing when using pharma
	 * Called from toggleActionButton in App
	 * @param props: object {
	 *     currentPcData: object,
	 *     updateCharacter: function (App),
	 *     updateLog: function (App),
	 *     setShowDialogProps: function (App),
	 *     updateActivePlayerActions: function (App)
	 * }
	 */
	betterLivingThroughChemicals = (props) => {
		const {currentPcData, updateCharacter, updateLog, setShowDialogProps, updateActivePlayerActions} = props;

		if (currentPcData.currentSanity === currentPcData.startingSanity) {
			const fullSanityDialogProps = {
				dialogContent: `${currentPcData.name}'s Sanity is already at its highest!`,
				closeButtonText: 'Ok',
				closeButtonCallback: null,
				disableCloseButton: false,
				actionButtonVisible: false,
				actionButtonText: '',
				actionButtonCallback: null,
				dialogClasses: ''
			};
			setShowDialogProps(true, fullSanityDialogProps);
			return;
		}

		const healProps = {
			itemId: 'pharmaceuticals0',
			itemStats: ItemTypes.Pharmaceuticals,
			isChemistSkill: true,
			targetData: currentPcData,
			pcData: currentPcData,
			updateCharacter,
			updateLog,
			callback: updateActivePlayerActions
		}
		this.heal(healProps);
	}

	/**
	 * Skill (Doctor): bring pc back to life if reduced to 0 health within last few turns
	 * Called from handleUnitClick in App
	 * @param props: object {
	 *     targetData: object
	 *     pcData: object,
	 *     updateCharacter: function (App),
	 *     updateLog: function (App),
	 *     setShowDialogProps: function (App),
	 *     callback: function
	 * }
	 */
	resuscitate = (props) => {
		const {targetData, pcData, updateCharacter, updateLog, setShowDialogProps, callback} = props;
		if (targetData.isDeadOrInsane) {
			const dialogProps = {
				dialogContent: `${targetData.name} has been dead for too long and can't be revived!`,
				closeButtonText: 'Ok',
				closeButtonCallback: null,
				disableCloseButton: false,
				actionButtonVisible: false,
				actionButtonText: '',
				actionButtonCallback: null,
				dialogClasses: ''
			}
			setShowDialogProps(true, dialogProps);
			return;
		}
		let updatedTargetData = deepCopy(targetData);
		let updatedHealerData = deepCopy(pcData);
		const resusSkillData = pcData.skills.resuscitate;
		updatedTargetData.currentHealth = resusSkillData.modifier[resusSkillData.level];
		updatedTargetData.turnsSinceDeath = 0;
		updatedHealerData.currentSpirit -= resusSkillData.spirit[resusSkillData.level];
		updateCharacter('player', updatedTargetData, targetData.id, false, false, false, () => {
			updateLog(`${pcData.name} resuscitates  ${targetData.name} back to life!`);
			updateCharacter('player', updatedHealerData, pcData.id, false, false, false, callback);
		});
	}

	/**
	 * Simple helper function to format status data to save to pc data
	 * @param charStatuses: object (status data from a pc)
	 * @param statusData: object (status data to be applied)
	 * @returns {*}
	 */
	updateStatus = (charStatuses, statusData) => {
		const {attribute, startingRound, turnsLeft, modifier} = statusData;
		charStatuses[statusData.name] = {attribute, startingRound, turnsLeft, modifier};
		return charStatuses;
	}

	/**
	 * Skill (Priest): provide buff to party, reducing sanity loss until
	 * Called from toggleActionButton in App
	 * @param props: object {
	 *     partyData: object,
	 *     currentRound: number,
	 *     updateCharacter: function (App),
	 *     updateLog: function (App),
	 *     updateActivePlayerActions: function (App)
	 * }
	 */
	comfortTheFearful = (props) => {
		const {partyData, currentRound, updateCharacter, updateLog, updateActivePlayerActions} = props;
		let updatedPartyData = deepCopy(partyData);
		const comfortSkillData = updatedPartyData.priest.skills.comfortTheFearful;

		for (const [id, charData] of Object.entries(partyData)) {
			const statusData = {
				name: 'sanityBuff',
				attribute: 'sanity',
				startingRound: currentRound,
				turnsLeft: comfortSkillData.turnsLeft[comfortSkillData.level],
				modifier: comfortSkillData.modifier[comfortSkillData.level]
			}
			updatedPartyData[id].statuses = this.updateStatus(charData.statuses, statusData);
		}
		updatedPartyData.priest.currentSpirit -= comfortSkillData.spirit[comfortSkillData.level];
		updateCharacter('player', updatedPartyData, null, false, false, false, () => {
			updateLog(`${updatedPartyData.priest.name} comforts the party, easing their minds from the horrors around them!`);
			updateActivePlayerActions();
		});
	}

	/**
	 * Skill (Priest): use both actions to recover some Spirit for the party
	 * Called from toggleActionButton in App
	 * @param props: object {
	 *     partyData: object,
	 *     updateCharacter: function (App),
	 *     updateLog: function (App),
	 *     updateActivePlayerActions: function (App)
	 * }
	 */
	spiritualInspiration = (props) => {
		const {partyData, updateCharacter, updateLog, updateActivePlayerActions} = props;
		let updatedPartyData = deepCopy(partyData);
		const inspireSkillData = updatedPartyData.priest.skills.spiritualInspiration;
		const inspireModifier = inspireSkillData.modifier[inspireSkillData.level];

		for (const id of Object.keys(partyData)) {
			const modifiedSpirit = updatedPartyData[id].currentSpirit + inspireModifier;
			updatedPartyData[id].currentSpirit = modifiedSpirit > updatedPartyData[id].startingSpirit ? updatedPartyData[id].startingSpirit : modifiedSpirit;
		}
		updateCharacter('player', updatedPartyData, null, false, false, false, () => {
			updateLog(`${updatedPartyData.priest.name} inspires the party, filling them with spiritual energy!`);
			updateActivePlayerActions(true);
		});
	}
}

export default Character;
