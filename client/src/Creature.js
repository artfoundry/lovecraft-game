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
		let logAttackMessage = `A ${this.name} lashes at ${targetData.name}...`;
		let logDamageMessage = `The ${this.name} misses.`;

		if (this.attackType === 'ranged') {
			hitRoll = this.agility + halfStr + diceRoll(20);
			defenseRoll = targetData.defense + diceRoll(6);
			damage = halfStr + this.damage + diceRoll(6) - targetData.damageReduction;
			logAttackMessage = `A ${this.name} reaches out toward ${targetData.name} with something disgusting...`;
		} else if (this.attackType === 'melee') {
			hitRoll = this.strength + halfAgility + diceRoll(20);
			defenseRoll = targetData.defense + diceRoll(6);
			damage = this.strength + this.damage + diceRoll(6) - targetData.damageReduction;
		} else if (this.attackType === 'psychic') {
			hitRoll = this.mentalAcuity + diceRoll(20);
			defenseRoll = targetData.mentalAcuity + diceRoll(6);
			damage = this.mentalAcuity + diceRoll(6) - defenseRoll;
			logAttackMessage = `A ${this.name} reaches out psychically to ${targetData.name}...`;
			logDamageMessage = `The ${this.name} fails to penetrate ${targetData.name}'s mind.`;
		}
		damage = damage < 0 ? 0 : damage;
		isHit = hitRoll >= defenseRoll;

		if (isHit) {
			const qualifier = damage > 10 ? ' hard' : '';
			const attackWord = this.attackType === 'psychic' ? `invades ${targetData.name}'s sanity` : 'hits';
			logDamageMessage = `The ${this.name} ${attackWord}${qualifier}!`;
		}
		updateLog(logAttackMessage);
		updateLog(logDamageMessage);

		if (isHit) {
			if (this.attackType === 'psychic') {
				targetData.currentSanity -= damage;
			} else {
				targetData.currentHealth -= damage;
			}
			updateTarget('player', targetData, targetData.id, false, false, false, updateTurnCallback);
		} else if (updateTurnCallback) {
			updateTurnCallback();
		}
	}
}

export default Creature;
