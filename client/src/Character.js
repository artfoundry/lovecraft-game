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
		this.items = props.items;
		this.defense = this.agility + (this.items.armor ? this.items.armor.value : 0);
		this.damageReduction = this.items.armor ? this.items.armor.value : 0;
		this.coords = {};
		this.equippedLight = null;
		this.lightRange = this.items.Light ? this.getLightRange() : 2;
	}

	attack = (weaponStats, creatureId, creatureData, updateCreature, updateLog) => {
		let isHit, damage, hitRoll, defenseRoll;
		let rangedStrHitModifier = weaponStats.attackType === 'manual' ? Math.round(this.strength / 2) : 0;

		if (weaponStats.ranged) {
			hitRoll = this.agility + rangedStrHitModifier + diceRoll(20);
			damage = rangedStrHitModifier + weaponStats.damage + diceRoll(6);
		} else {
			hitRoll = this.strength + Math.round(this.agility / 2) + diceRoll(20);
			damage = this.strength + weaponStats.damage + diceRoll(6);
		}
		defenseRoll = creatureData.defense + diceRoll(6);
		isHit = hitRoll >= defenseRoll;
		updateLog(`Player attacks with ${hitRoll} to hit vs ${defenseRoll} defense`);
		if (isHit) {
			creatureData.currentHP -= damage;
			updateCreature('creature', creatureData, creatureId);
		}
		updateLog(isHit ? 'Player hits for ' + damage + ' damage' : 'Player misses');
	}

	getLightRange() {
		let highestRange = 0;
		this.items.Light.forEach(source => {
			const range = ItemTypes.Light[source].range;
			if (range > highestRange) {
				highestRange = range;
				this.equippedLight = source;
			}
		});
		return highestRange;
	}
}

export default Character;
