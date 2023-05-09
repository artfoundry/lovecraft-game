import React from "react";
import {diceRoll} from './Utils';
import ItemTypes from "./data/itemTypes.json";

class Character extends React.Component {
	constructor(props) {
		super(props);

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
		this.ammo = props.ammo;
		this.items = props.items;
		this.defense = this.agility + (this.items.Armor ? this.items.Armor.value : 0);
		this.damageReduction = this.items.Armor ? this.items.Armor.value : 0;
		this.coords = {};
		this.equippedLight = null;
		this.lightRange = this.items.Light ? this.getLightRange() : 1;
		this.lightTime = this.equippedLight ? this.items.Light[this.equippedLight].time : 0;
	}

	attack = (weaponName, weaponStats, creatureId, creatureData, updateCreature, updateLog) => {
		let isHit, damage, hitRoll, defenseRoll;
		let rangedStrHitModifier = weaponStats.attackType === 'manual' ? Math.round(this.strength / 2) : 0;

		if (weaponStats.ranged) {
			hitRoll = this.agility + rangedStrHitModifier + diceRoll(20);
			damage = rangedStrHitModifier + weaponStats.damage + diceRoll(6);
			const gunType = this.weapons.ranged[weaponName].gunType;
			if (gunType) {
				this.ammo[gunType]--;
			} else {
				this.weapons.ranged[weaponName]--;
			}
		} else {
			hitRoll = this.strength + Math.round(this.agility / 2) + diceRoll(20);
			damage = this.strength + weaponStats.damage + diceRoll(6);
		}
		defenseRoll = creatureData.defense + diceRoll(6);
		isHit = hitRoll >= defenseRoll;
		updateLog(`${this.name} attacks with ${hitRoll} to hit vs ${defenseRoll} defense`);
		if (isHit) {
			creatureData.currentHP -= damage;
			updateCreature('creature', creatureData, creatureId);
		}
		updateLog(isHit ? `${this.name} hits for ${damage} damage` : this.name + ' misses');
	}

	getLightRange() {
		let highestRange = 0;
		for (const type of Object.keys(this.items.Light)) {
			const range = ItemTypes.Light[type].range;
			if (range > highestRange) {
				highestRange = range;
				this.equippedLight = type;
			}
		}
		return highestRange;
	}
}

export default Character;
