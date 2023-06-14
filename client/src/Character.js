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
		this.startingHP = props.startingHP;
		this.currentHP = props.startingHP;
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
	 *  weaponId: string,
	 *  weaponStats: object,
	 *  creatureData: object,
	 *  pcData: object,
	 *  updateCharacter: function (from App),
	 *  updateLog: function (from App),
	 *  callback: function (from App - calls toggleWeapon, _removeDeadFromTurnOrder if creature dies, then _updateActivePlayerActions)
	 * )
	 */
	attack = (props) => {
		const {weaponId, weaponStats, creatureData, pcData, updateCharacter, updateLog, callback} = props;
		let isHit, damage, hitRoll, defenseRoll;
		let rangedStrHitModifier = weaponStats.usesStr ? Math.round(this.strength / 2) : 0;
		let updatedPcData = {...pcData};
		let updatedCreatureData = {...creatureData};

		if (weaponStats.ranged) {
			hitRoll = this.agility + rangedStrHitModifier + diceRoll(20);
			damage = rangedStrHitModifier + weaponStats.damage + diceRoll(6);
			const gunType = this.weapons[weaponId].gunType;
			gunType ? updatedPcData.ammo[gunType]-- : updatedPcData.ammo.stackable[this.weapons[weaponId].name]--;
		} else {
			hitRoll = this.strength + Math.round(this.agility / 2) + diceRoll(20);
			damage = this.strength + weaponStats.damage + diceRoll(6);
		}
		defenseRoll = creatureData.defense + diceRoll(6);
		isHit = hitRoll >= defenseRoll;
		updateLog(`${this.name} attacks with ${hitRoll} to hit vs ${defenseRoll} defense`);
		updateCharacter('player', updatedPcData, pcData.id, false, false, () => {
			if (isHit) {
				updatedCreatureData.currentHP -= damage;
				updateCharacter('creature', updatedCreatureData, creatureData.id, false, false, callback);
			} else if (callback) {
				callback();
			}
		});
		updateLog(isHit ? `${this.name} hits for ${damage} damage` : this.name + ' misses');
	}

}

export default Character;
