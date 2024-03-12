import React from 'react';
import {diceRoll} from './Utils';

class Creature extends React.Component {
	constructor(props) {
		super(props);
		this.hitDie = 10;
		this.damageDie = 6;
		this.defenseDie = 4;

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
		this.startingSpirit = props.startingSpirit;
		this.currentSpirit = props.startingSpirit;
		this.range = props.range;
		this.attackType = props.attackType;
		this.moveSpeed = props.moveSpeed;
		this.perception = props.perception;
		this.skills = props.skills;
		this.coords = props.coords;
	}

	attack = (targetData, updateTarget, updateLog, updateTurnCallback = null) => {
		let isHit, damageTotal = 0, hitTotal = 0, defenseTotal = 0;
		let halfStr = Math.round(this.strength / 2);
		let halfAgility = Math.round(this.agility / 2);
		let logAttackMessage = `A ${this.name} lashes at ${targetData.name}...`;
		let logDamageMessage = `The ${this.name} misses.`;
		const hitRoll = diceRoll(this.hitDie);
		const damageRoll = diceRoll(this.damageDie);
		const defenseRoll = diceRoll(this.defenseDie);

		if (this.attackType === 'ranged') {
			hitTotal = this.agility + halfStr + hitRoll;
			defenseTotal = targetData.defense + defenseRoll;
			damageTotal = halfStr + this.damage + damageRoll - targetData.damageReduction;
			logAttackMessage = `A ${this.name} reaches out toward ${targetData.name} with something disgusting...`;
		} else if (this.attackType === 'melee') {
			hitTotal = this.strength + halfAgility + hitRoll;
			defenseTotal = targetData.defense + defenseRoll;
			damageTotal = this.strength + this.damage + damageRoll - targetData.damageReduction;
		} else if (this.attackType === 'psychic') {
			hitTotal = this.mentalAcuity + hitRoll;
			defenseTotal = targetData.mentalAcuity + defenseRoll;
			damageTotal = this.mentalAcuity + damageRoll;
			logAttackMessage = `A ${this.name} reaches out psychically to ${targetData.name}...`;
			logDamageMessage = `The ${this.name} fails to penetrate ${targetData.name}'s mind.`;
		}
		damageTotal = damageTotal < 0 ? 0 : damageTotal;
		isHit = hitTotal >= defenseTotal;

		if (isHit) {
			const qualifier = damageTotal > 10 ? 'brutally' : '';
			const attackWord = this.attackType === 'psychic' ? ` invades ${targetData.name}'s sanity` : ` hits ${targetData.name}`;
			logDamageMessage = `The ${this.name} ${qualifier}${attackWord}!`;
		}
		updateLog(logAttackMessage);
		updateLog(logDamageMessage);

		if (isHit) {
			if (this.attackType === 'psychic') {
				targetData.currentSanity -= damageTotal;
			} else {
				targetData.currentHealth -= damageTotal;
			}
			updateTarget('player', targetData, targetData.id, false, false, false, updateTurnCallback);
		} else if (updateTurnCallback) {
			updateTurnCallback();
		}
	}
}

export default Creature;
