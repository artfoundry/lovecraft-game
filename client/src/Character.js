import React from 'react';
import {diceRoll, deepCopy} from './Utils';
import ItemTypes from './data/itemTypes.json';
import WeaponTypes from './data/weaponTypes.json';
import Skills from './data/skills.json';

class Character extends React.Component {
	constructor(props) {
		super(props);

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
		this.startingSanity = props.startingSanity;
		this.currentSanity = props.startingSanity;
		this.startingSpirit = (this.startingHealth / 2) + (this.startingSanity / 2);
		this.currentSpirit = (this.startingHealth / 2) + (this.startingSanity / 2);
		this.skills = this._copySkillData(props.skills);
		this.inventory = this._prePopulateInv(props.playerInventoryLimit);
		this.weapons = this._populateInvInfo('weapon', props.weapons, props.equippedItems);
		this.equippedItems = {
			loadout1: {right: props.equippedItems.right, left: this.weaponIsTwoHanded(props.equippedItems.right) ? props.equippedItems.right : props.equippedItems.left},
			loadout2: {right: '', left: ''},
			armor: props.equippedItems.armor || ''
		};
		this.items = this._populateInvInfo('item', props.items, props.equippedItems);
		this.maxItems = 12;
		this.defense = this.calculateDefense();
		this.damageReduction = this.equippedItems.armor ? this.items[this.equippedItems.armor].damageReduction : 0;
		this.coords = {};
		this.equippedLight = props.equippedLight || null;
		this.lightRange = this.equippedLight ? this.items[this.equippedLight].range : 0;
		this.lightTime = this.equippedLight ? this.items[this.equippedLight].time : null;
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
			skillData[skillId] = Skills[skillId];
		});
		return skillData;
	}

	calculateDefense = () => {
		return this.agility + (this.equippedItems.armor ? this.items[this.equippedItems.armor].defense : 0);
	}

	weaponIsTwoHanded = (weapon) => {
		return this.weapons[weapon] && WeaponTypes[this.weapons[weapon].name].twoHanded;
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
		let isHit, damage, hitRoll, defenseRoll;
		let rangedStrHitModifier = itemStats.usesStr ? Math.round(this.strength / 2) : 0;
		let updatedPcData = deepCopy(pcData);
		let updatedCreatureData = deepCopy(targetData);
		const weaponInfo = updatedPcData.weapons[itemId];
		const equippedSide = pcData.equippedItems.loadout1.right === itemId ? 'right' : 'left';

		if (itemStats.ranged) {
			hitRoll = this.agility + rangedStrHitModifier + diceRoll(20);
			damage = rangedStrHitModifier + itemStats.damage + diceRoll(6) - targetData.damageReduction;
			weaponInfo.currentRounds--;
			if (weaponInfo.currentRounds === 0 && weaponInfo.stackable) {
				delete updatedPcData.weapons[itemId];
				updatedPcData.equippedItems.loadout1[equippedSide] = '';
			}
		} else {
			hitRoll = this.strength + Math.round(this.agility / 2) + diceRoll(20);
			damage = this.strength + itemStats.damage + diceRoll(6) - targetData.damageReduction;
		}
		damage = damage < 0 ? 0 : damage;
		defenseRoll = targetData.defense + diceRoll(6);
		isHit = hitRoll >= defenseRoll;
		updateLog(`${this.name} attacks with a ${weaponInfo.name} and rolls ${hitRoll} to hit...`);
		updateCharacter('player', updatedPcData, pcData.id, false, false, false, () => {
			if (isHit) {
				updatedCreatureData.currentHealth -= damage;
				updateCharacter('creature', updatedCreatureData, targetData.id, false, false, false, callback);
			} else if (callback) {
				callback();
			}
		});
		updateLog(isHit ? `${this.name} hits for ${damage} damage!` : this.name + ' misses.');
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
	 *  callback: function (from App - calls toggleWeapon, _removeDeadFromTurnOrder if creature dies, then _updateActivePlayerActions)
	 * )
	 */
	heal = (props) => {
		const {itemId, itemStats, targetData, pcData, updateCharacter, updateLog, callback} = props;
		const healItem = pcData.items[itemId].name;
		const targetStat = itemStats.healingType === 'health' ? 'currentHealth' : 'currentSanity';
		const startingStatValue = itemStats.healingType === 'health' ? targetData.startingHealth : targetData.startingSanity;
		const healAmount = Math.round(pcData.mentalAcuity / 2) + (itemStats.healingType === 'health' ? diceRoll(12) : diceRoll(4)) + itemStats.healingAmount;
		let updatedTargetData = deepCopy(targetData);
		const healedStatValue = targetData[targetStat] + healAmount;
		updatedTargetData[targetStat] = healedStatValue > startingStatValue ? startingStatValue : healedStatValue;
		let updatedHealerData = deepCopy(pcData);
		delete updatedHealerData.items[itemId];
		updateCharacter('player', updatedTargetData, targetData.id, false, false, false, () => {
			updateLog(`${pcData.name} uses ${healItem} to increase ${targetData.name}'s ${targetStat.substring(7)}`);
			updateCharacter('player', updatedHealerData, pcData.id, false, false, false, callback);
		});
	}

	/** Profession Skills **/

	/**
	 * Creates an item using materials and light (cost); enemies must not be around in order to use
	 * @param props: object {
	 *     itemType: string ('firstAidKit', 'molotovCocktail', 'torch', 'acidConcoction', 'pharmaceuticals', 'holyWater'),
	 *     activeCharId: string,
	 *     currentPcData: object,
	 *     updateCharacter: function (from App),
	 *     updateLog: function (from App),
	 *     setShowDialogProps: function (from App),
	 *     addItemToPlayerInventory: function (from App)
	 * }
	 */
	create = (props) => {
		const {itemType, activeCharId, currentPcData, updateCharacter, updateLog, setShowDialogProps, addItemToPlayerInventory} = props;
		const materialCosts = this.skills[itemType].cost;
		const lightCost = this.skills[itemType].light;
		const itemName = this.skills[itemType].name;
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
		const itemCategory = this.skills[itemType].itemCategory;
		let itemData = {};
		if (itemCategory === 'items') {
			itemData = {...ItemTypes[itemName]};
		} else if (itemCategory === 'weapons') {
			itemData = {...WeaponTypes[itemName]};
		}
		if (updatedPcData.items[itemId] && itemData.stackable) {
			if (itemCategory === 'items') {
				itemData.amount++;
			} else if (itemCategory === 'weapons') {
				itemData.currentRounds++;
			}
		}

		updateLog(`${currentPcData.name} creates a${itemType === 'acidConcoction' ? 'n' : ''} ${itemName}.`);
		// update stackable counts if applicable and remove used materials
		updateCharacter('player', updatedPcData, activeCharId, false, false, false, () => {
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
			addItemToPlayerInventory(itemData, itemId, activeCharId, false);
		});
	}

}

export default Character;
