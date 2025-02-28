import React from 'react';
import {removeIdNumber, diceRoll} from './Utils';

class Creature extends React.PureComponent {
	constructor(props) {
		super(props);
		this.hitDie = 10;
		this.defenseDie = 4;

		this.id = props.id;
		this.name = props.name;
		this.type = props.type;
		this.race = props.race;
		this.isOldOne = props.isOldOne;
		this.level = props.level;
		this.expertisePoints = props.expertisePoints;
		this.coords = props.coords;
		this.strength = props.strength;
		this.agility = props.agility;
		this.mentalAcuity = props.mentalAcuity;
		this.initiative = props.mentalAcuity + props.agility;
		this.damage = props.damage;
		this.defense = props.defense;
		this.damageReduction = props.damageReduction;
		this.startingHealth = props.startingHealth;
		this.currentHealth = props.isSavedData ? props.currentHealth : props.startingHealth;
		this.startingSpirit = props.startingSpirit;
		this.currentSpirit = props.isSavedData ? props.currentSpirit : props.startingSpirit;
		this.range = props.range;
		this.attackType = props.attackType;
		this.moveSpeed = props.moveSpeed;
		this.perception = props.perception;
		this.skills = props.skills;
		this.statuses = props.isSavedData ? props.statuses : {};
		this.isRemoved = props.isSavedData ? props.isRemoved : false;
	}

	attack = (targetData, updateTarget, updateLog, toggleAudio, updateTurnCallback = null) => {
		let isHit, damageTotal = 0, hitTotal = 0, defenseTotal = 0;
		let halfStr = Math.round(this.strength / 2);
		let halfAgility = Math.round(this.agility / 2);
		let logAttackMessage = `A ${this.name} lashes at ${targetData.name} with something disgusting...`;
		let logDamageMessage = `The ${this.name} misses.`;
		const hitRoll = diceRoll(this.hitDie);
		const defenseRoll = diceRoll(this.defenseDie);

		if (this.attackType === 'ranged') {
			hitTotal = this.agility + halfStr + hitRoll;
			defenseTotal = targetData.defense + defenseRoll;
			const attackDifference = hitTotal - defenseTotal;
			const damageModBasedOnAttack = attackDifference <= 0 ? 0 : Math.round(attackDifference / 2);
			damageTotal = halfStr + this.damage + damageModBasedOnAttack - targetData.damageReduction;
			logAttackMessage = `A ${this.name} launches something at ${targetData.name}...`;
		} else if (this.attackType === 'melee') {
			hitTotal = this.strength + halfAgility + hitRoll;
			defenseTotal = targetData.defense + defenseRoll;
			const attackDifference = hitTotal - defenseTotal;
			const damageModBasedOnAttack = attackDifference <= 0 ? 0 : Math.round(attackDifference / 2);
			damageTotal = this.strength + this.damage + damageModBasedOnAttack - targetData.damageReduction;
		} else if (this.attackType === 'psychic') {
			const damageAdjustment = targetData.statuses.sanityBuff ? targetData.statuses.sanityBuff.modifier : 0;
			hitTotal = this.mentalAcuity + hitRoll;
			defenseTotal = targetData.mentalAcuity + defenseRoll;
			const attackDifference = hitTotal - defenseTotal;
			const damageModBasedOnAttack = attackDifference <= 0 ? 0 : Math.round(attackDifference / 2);
			damageTotal = this.mentalAcuity + damageModBasedOnAttack - damageAdjustment;
			logAttackMessage = `A ${this.name} psychically attacks ${targetData.name}...`;
			logDamageMessage = `The ${this.name} fails to penetrate ${targetData.name}'s mind.`;
		}
		damageTotal = damageTotal < 0 ? 0 : damageTotal;
		isHit = hitTotal >= defenseTotal;

		if (isHit) {
			const qualifier = damageTotal > 20 ? 'brutally' : '';
			const attackWord = this.attackType === 'psychic' ? ` invades ${targetData.name}'s sanity` : ` hits ${targetData.name}`;
			logDamageMessage = `The ${this.name} ${qualifier}${attackWord}!`;
		}
		updateLog(logAttackMessage);
		updateLog(logDamageMessage);
		toggleAudio('characters', removeIdNumber(this.id) + 'Attack', {useReverb: true, useVolume: true, soundCoords: this.coords});

		if (isHit) {
			const feelThePainSkill = targetData.skills.feelThePain;
			if (this.attackType === 'psychic' && (!feelThePainSkill || (feelThePainSkill && !feelThePainSkill.active))) {
				const resultingSanity = targetData.currentSanity - damageTotal;
				targetData.currentSanity = resultingSanity < 0 ? 0 : resultingSanity;
			} else {
				if (this.attackType === 'psychic' && feelThePainSkill && feelThePainSkill.active) {
					damageTotal += damageTotal;
					feelThePainSkill.active = false;
					updateLog(`${targetData.name} endures the psychic attack, feeling the pain physically`);
				}
				const resultingHealth = targetData.currentHealth - damageTotal;
				targetData.currentHealth = resultingHealth < 0 ? 0 : resultingHealth;
			}
			updateTarget('player', targetData, targetData.id, false, false, false, updateTurnCallback);
		} else if (updateTurnCallback) {
			updateTurnCallback();
		}
	}

}

export default Creature;
