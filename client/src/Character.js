import React from 'react';
import {diceRoll} from './Utils';
import ItemTypes from './data/itemTypes.json';
import WeaponTypes from './data/weaponTypes.json';

class Character extends React.Component {
	constructor(props) {
		super(props);

		this.itemTypes = ItemTypes;

		// For instantiation only - updated data is stored in App.state.playerCharacters
		this.id = props.id;
		this.name = props.name;
		this.type = props.type;
		this.profession = props.profession;
		this.level = 1;
		this.xp = 0;
		this.strength = props.strength;
		this.agility = props.agility;
		this.mentalAcuity = props.mentalAcuity;
		this.initiative = props.mentalAcuity + props.agility;
		this.startingHealth = props.startingHealth;
		this.currentHealth = props.startingHealth;
		this.startingSanity = props.startingSanity;
		this.currentSanity = props.startingSanity;
		this.skills = props.skills;
		this.weapons = props.weapons;
		this.equippedItems = {
			loadout1: {right: props.equippedItems.right, left: this.weaponIsTwoHanded(props.equippedItems.right) ? props.equippedItems.right : props.equippedItems.left},
			loadout2: {right: '', left: ''},
			armor: props.equippedItems.armor || ''
		};
		this.ammo = props.ammo;
		this.items = props.items;
		this.maxItems = 12;
		this.defense = this.agility + (this.items.armor ? this.items.armor.defense : 0);
		this.damageReduction = this.items.armor ? this.items.armor.defense : 0;
		this.coords = {};
		this.equippedLight = props.equippedLight || null;
		this.lightRange = this.equippedLight ? this.items[this.equippedLight].range : 0;
		this.lightTime = this.equippedLight ? this.items[this.equippedLight].time : null;
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
		let updatedPcData = {...pcData};
		let updatedCreatureData = {...targetData};

		if (itemStats.ranged) {
			hitRoll = this.agility + rangedStrHitModifier + diceRoll(20);
			damage = rangedStrHitModifier + itemStats.damage + diceRoll(6) - targetData.damageReduction;
			const gunType = this.weapons[itemId].gunType;
			gunType ? updatedPcData.ammo[gunType]-- : updatedPcData.ammo.stackable[this.weapons[itemId].name]--;
		} else {
			hitRoll = this.strength + Math.round(this.agility / 2) + diceRoll(20);
			damage = this.strength + itemStats.damage + diceRoll(6) - targetData.damageReduction;
		}
		damage = damage < 0 ? 0 : damage;
		defenseRoll = targetData.defense + diceRoll(6);
		isHit = hitRoll >= defenseRoll;
		updateLog(`${this.name} attacks with ${hitRoll} to hit vs ${defenseRoll} defense`);
		updateCharacter('player', updatedPcData, pcData.id, false, false, () => {
			if (isHit) {
				updatedCreatureData.currentHealth -= damage;
				updateCharacter('creature', updatedCreatureData, targetData.id, false, false, callback);
			} else if (callback) {
				callback();
			}
		});
		updateLog(isHit ? `${this.name} hits for ${damage} damage` : this.name + ' misses');
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
		let updatedTargetData = {...targetData};
		const healedStatValue = targetData[targetStat] + healAmount;
		updatedTargetData[targetStat] = healedStatValue > startingStatValue ? startingStatValue : healedStatValue;
		let updatedHealerData = {...pcData};
		delete updatedHealerData.items[itemId];
		updateCharacter('player', updatedTargetData, targetData.id, false, false, () => {
			updateLog(`${pcData.name} uses ${healItem} to increase ${targetData.name}'s ${targetStat.substring(7)}`);
			updateCharacter('player', updatedHealerData, pcData.id, false, false, callback);
		});
	}

}

export default Character;
