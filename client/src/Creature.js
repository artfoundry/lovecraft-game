import React from 'react';
import {diceRoll} from './Utils';

class Creature extends React.Component {
	constructor(props) {
		super(props);

		this.id = props.creatureId;
		this.name = props.name;
		this.type = props.type;
		this.level = props.level;
		this.strength = props.strength;
		this.agility = props.agility;
		this.mentalAcuity = props.mentalAcuity;
		this.initiative = props.mentalAcuity + props.agility;
		this.damage = props.damage;
		this.defense = props.defense;
		this.damageReduction = props.damageReduction;
		this.startingHealth = props.startingHealth;
		this.currentHealth = props.startingHealth;
		this.range = props.range;
		this.attackType = props.attackType;
		this.moveSpeed = props.moveSpeed;
		this.perception = props.perception;
		this.skills = props.skills;
		this.coords = props.coords;
	}

	attack = (targetData, updateTarget, updateLog, updateTurnCallback = null) => {
		let isHit, damage, hitRoll, defenseRoll;
		let halfStr = Math.round(this.strength / 2);
		let halfAgility = Math.round(this.agility / 2);

		if (this.attackType === 'ranged') {
			hitRoll = this.agility + halfStr + diceRoll(20);
			defenseRoll = targetData.defense + diceRoll(6);
			damage = halfStr + this.damage + diceRoll(6) - targetData.damageReduction;
		} else if (this.attackType === 'melee') {
			hitRoll = this.strength + halfAgility + diceRoll(20);
			defenseRoll = targetData.defense + diceRoll(6);
			damage = this.strength + this.damage + diceRoll(6) - targetData.damageReduction;
		} else {
			hitRoll = this.mentalAcuity + diceRoll(20);
			defenseRoll = targetData.mentalAcuity + diceRoll(6);
			damage = this.mentalAcuity + diceRoll(6) - defenseRoll;
		}
		damage = damage < 0 ? 0 : damage;
		isHit = hitRoll >= defenseRoll;

		updateLog(`A ${this.name} attacks ${targetData.name} with ${hitRoll} to hit vs ${defenseRoll} defense`);
		updateLog(isHit ? `The ${this.name} hits for ${damage} damage` : `The ${this.name} misses`);
		if (isHit) {
			targetData.currentHealth -= damage;
			updateTarget('player', targetData, targetData.id, false, false, false, updateTurnCallback);
		} else if (updateTurnCallback) {
			updateTurnCallback();
		}
	}
}

export default Creature;
