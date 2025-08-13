import React from 'react';
import {removeIdNumber, articleType, diceRoll, deepCopy} from './Utils';
import Statuses from './data/statuses.json';

class Creature extends React.PureComponent {
	constructor(props) {
		super(props);
		this.hitDie = 6;
		this.defenseDie = 4;
		this.hitRoll = 0;
		this.defenseRoll = 0;
		this.reactionSoundDelay = 500; // for setTimeouts for when multiple pcs are targeted and output reaction sfx

		//todo: move this to App
		this.excessiveDamageLimit = 30;

		this.id = props.id;
		this.name = props.name;
		this.type = props.type;
		this.race = props.race;
		this.isOldOne = props.isOldOne;
		this.level = props.level;
		this.expertisePoints = props.expertisePoints;
		this.sanityEffect = props.sanityEffect;
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
		this.spiritRegeneration = props.spiritRegeneration;
		this.range = props.range;
		this.attackType = props.attackType;
		this.moveSpeed = props.moveSpeed;
		this.perception = props.perception;
		this.skillPriority = [...props.skillPriority];
		this.skills = deepCopy(props.skills);
		this.statuses = props.isSavedData ? props.statuses : {};
		this.isRemoved = props.isSavedData ? props.isRemoved : false;
		this.relatedMission = props.relatedMission || null;
	}

	rollForAttackAndDefense() {
		this.hitRoll = diceRoll(this.hitDie);
		this.defenseRoll = diceRoll(this.defenseDie);
	}

	/**
	 * Attack a pc
	 * @param targetData object (pc data)
	 * @param identifiedCreatures object (part of identifiedThings from App)
	 * @param updateTarget function (App's updateCharacters)
	 * @param updateLog function
	 * @param toggleAudio function
	 * @param updateTurnCallback function
	 */
	attack = (targetData, identifiedCreatures, updateTarget, updateLog, toggleAudio, updateTurnCallback = null) => {
		let isHit, damageTotal = 0, hitTotal = 0, defenseTotal = 0;
		const rangedStrBonus = Math.round(this.strength / 3); // bonus for ranged attacks
		const meleeAgilityBonus = Math.round(this.agility / 3); // bonus for str attacks
		const targetStealth = targetData.statuses.stealthy;
		const targetStealthBonus = targetStealth ? targetStealth.modifier : 0;
		const damageRoll = diceRoll(this.damage.roll) + this.damage.bonus;
		const creatureName = identifiedCreatures[this.name] && identifiedCreatures[this.name].name ? this.name : 'creature';
		let logAttackMessage = `${articleType(creatureName, true)} ${creatureName} lashes at ${targetData.name.first} with something disgusting...`;
		let logDamageMessage = `The ${creatureName} misses.`;
		this.rollForAttackAndDefense();

		if (this.attackType === 'ranged') {
			hitTotal = this.agility + rangedStrBonus + this.hitRoll;
			defenseTotal = targetData.defense + targetStealthBonus + this.defenseRoll;
			const attackDifference = hitTotal - defenseTotal;
			const damageModBasedOnAttack = attackDifference <= 0 ? 0 : Math.round(attackDifference / 3);
			damageTotal = rangedStrBonus + damageRoll + damageModBasedOnAttack - targetData.damageReduction;
			logAttackMessage = `${articleType(creatureName, true)} ${creatureName} launches something at ${targetData.name.first}...`;
		} else if (this.attackType === 'melee') {
			hitTotal = this.strength + meleeAgilityBonus + this.hitRoll;
			defenseTotal = targetData.defense + targetStealthBonus + this.defenseRoll;
			const attackDifference = hitTotal - defenseTotal;
			const damageModBasedOnAttack = attackDifference <= 0 ? 0 : Math.round(attackDifference / 3);
			damageTotal = this.strength + damageRoll + damageModBasedOnAttack - targetData.damageReduction;
		} else if (this.attackType === 'psychic') {
			const damageAdjustment = targetData.statuses.sanityProtection ? targetData.statuses.sanityProtection.modifier : 0;
			hitTotal = this.mentalAcuity + this.hitRoll;
			defenseTotal = targetData.mentalAcuity + this.defenseRoll;
			const attackDifference = hitTotal - defenseTotal;
			const damageModBasedOnAttack = attackDifference <= 0 ? 0 : Math.round(attackDifference / 3);
			damageTotal = this.mentalAcuity + damageRoll + damageModBasedOnAttack - damageAdjustment;
			logAttackMessage = `${articleType(creatureName, true)} ${creatureName} psychically attacks ${targetData.name.first}...`;
			logDamageMessage = `...but fails to penetrate ${targetData.name.first}'s mind.`;
		}
		damageTotal = damageTotal < 0 ? 0 : damageTotal;
		isHit = hitTotal >= defenseTotal;

		if (isHit) {
			const qualifier = damageTotal > this.excessiveDamageLimit ? (this.attackType === 'psychic' ? 'greatly' : 'brutally') : '';
			const attackWord = this.attackType === 'psychic' ? ` weakens ${targetData.name.first}'s sanity` : ` hits ${targetData.name.first}`;
			logDamageMessage = `...and ${qualifier}${attackWord}!`;
		}
		updateLog(logAttackMessage);
		updateLog(logDamageMessage);
		toggleAudio('characters', removeIdNumber(this.id) + 'Attack', {useReverb: true, useVolume: true, soundCoords: this.coords});

		if (isHit) {
			const feelThePainSkill = targetData.statuses.feelThePain;
			if (this.attackType === 'psychic' && !feelThePainSkill) {
				const resultingSanity = targetData.currentSanity - damageTotal;
				targetData.currentSanity = resultingSanity < 0 ? 0 : resultingSanity;
			} else {
				if (this.attackType === 'psychic' && feelThePainSkill) {
					damageTotal += damageTotal;
					delete targetData.statuses.feelThePain;
					updateLog(`${targetData.name.first} endures the psychic attack, feeling the pain physically`);
				}
				const resultingHealth = targetData.currentHealth - damageTotal;
				targetData.currentHealth = resultingHealth < 0 ? 0 : resultingHealth;
			}
			updateTarget('player', targetData, targetData.id, false, false, false, updateTurnCallback);
		} else if (updateTurnCallback) {
			updateTurnCallback();
		}
	}

	/**
	 * For updating a creature's spirit after using a skill that targets something other than itself
	 * @param creatureData object (passed is deepcopy)
	 * @param spiritCost number
	 * @param updateCharacters function
	 * @param updatePcCallback function
	 * @private
	 */
	_updateSpirit(creatureData, spiritCost, updateCharacters, updatePcCallback) {
		creatureData.currentSpirit -= spiritCost;
		updateCharacters('creature', creatureData, creatureData.id, false, false, false, updatePcCallback);
	}

	/**
	 * Creature uses a skill to try to apply a status to a pc
	 * @param props: object (
	 *  pcData: object (pc data)
	 *  creatureData: object (deepcopy of creature's data)
	 *  identifiedCreatures: object (part of identifiedThings from App)
	 *  updateCharacters: function (App's updateCharacters)
	 *  skillName: string
	 *  updateLog: function
	 *  toggleAudio: function
	 *  updateTurnCallback: function
	 * )
	 */
	attemptToApplyStatus = (props) => {
		const {pcData, creatureData, identifiedCreatures, updateCharacters, skillName, updateLog, toggleAudio, updateTurnCallback} = props;
		this.rollForAttackAndDefense();
		const skill = this.skills[skillName];
		const status = skill.status;
		const relevantStat = skill.stat;
		const hitTotal = this[relevantStat] + this.hitRoll;
		const targetStealth = pcData.statuses.stealthy;
		const targetAgilityBonus = targetStealth ? targetStealth.modifier : 0;
		const defenseTotal = pcData[relevantStat] + targetAgilityBonus + this.defenseRoll;
		let logMessage = '';
		const creatureName = identifiedCreatures[this.name] && identifiedCreatures[this.name].name ? `${articleType(this.name, true)} ${this.name}` : 'A creature';
		const logMessageAction = relevantStat === 'mentalAcuity' ? 'psychically probes' : 'reaches out with a disgusting appendage to';
		const targetPronoun = pcData.gender === 'Male' ? 'him' : 'her';

		if (hitTotal >= defenseTotal) {
			pcData.statuses[status] = {
				name: Statuses[status].name,
				description: Statuses[status].description,
				turnsLeft: diceRoll(skill.maxTurns),
				chanceOfEffect: skill.chanceOfEffect
			}
			logMessage = `${creatureName} ${logMessageAction} ${pcData.name.first} and causes ${targetPronoun} to be ${status}!`;
			//todo: add skill specific audio?
			toggleAudio('characters', removeIdNumber(this.id) + 'Attack', {useReverb: true, useVolume: true, soundCoords: this.coords});
			this._updateSpirit(creatureData, skill.spirit, updateCharacters, () => {
				updateCharacters('player', pcData, pcData.id, false, false, false, () => {
					toggleAudio('characters', pcData.gender.toLowerCase() + 'Injured', {useReverb: true, useVolume: true, soundCoords: pcData.coords});
					if (updateTurnCallback) updateTurnCallback();
				});
			});
		} else {
			logMessage = `${creatureName} ${logMessageAction} ${pcData.name.first} but fortunately fails to make contact.`;
			this._updateSpirit(creatureData, skill.spirit, updateCharacters, updateTurnCallback);
		}
		updateLog(logMessage);
	}

	/**
	 * Creature turns invisible
	 * @param props: object ({
	 *  creatureData: object (creature's data)
	 *  identifiedCreatures: object (part of identifiedThings from App)
	 *  updateCharacters: function (App's updateCharacters)
	 *  updateLog: function
	 *  updateTurnCallback: function
	 * })
	 */
	phase = (props) => {
		const {creatureData, identifiedCreatures, updateCharacters, updateLog, updateTurnCallback} = props;
		const phaseSkill = this.skills.phase;
		const creatureName = identifiedCreatures[this.name] && identifiedCreatures[this.name].name ? `The ${this.name}` : 'A creature';
		creatureData.statuses.invisible = {
			name: Statuses.invisible.name,
			description: Statuses.invisible.description,
			turnsLeft: phaseSkill.turns
		}
		// _checkForUsableSkill in Map checks if creature has enough spirit, so don't need to check here
		creatureData.currentSpirit -= phaseSkill.spirit;
		updateCharacters('creature', creatureData, creatureData.id, false, false, false, () => {
			updateLog(`${creatureName} has vanished!`);
			if (updateTurnCallback) updateTurnCallback();
		});
	}

	/**
	 * Flying Polyp skill to drain target's spirit
	 * @param props object ({
	 *  pcData: object (target pc's data)
	 *  creatureData: object (creature's data)
	 *  identifiedCreatures: object (part of identifiedThings from App)
	 *  updateCharacters: function (App's updateCharacters)
	 *  updateLog: function
	 *  toggleAudio: function
	 *  updateTurnCallback: function
	 * })
	 */
	cyclone = (props) => {
		const {pcData, creatureData, identifiedCreatures, updateCharacters, updateLog, toggleAudio, updateTurnCallback} = props;
		const cycloneSkill = this.skills.cyclone;
		this.rollForAttackAndDefense();
		const hitTotal = this.mentalAcuity + this.hitRoll;
		const defenseTotal = pcData.mentalAcuity + this.defenseRoll;
		const creatureName = identifiedCreatures[this.name] && identifiedCreatures[this.name].name ? this.name : 'creature';
		let logMessage = '';

		if (hitTotal >= defenseTotal) {
			const damage = diceRoll(cycloneSkill.damage.roll) + cycloneSkill.damage.bonus;
			const damageResult = pcData.currentSpirit - damage;
			const spiritCost = cycloneSkill.spirit - (Math.floor(damage * cycloneSkill.percentReturned));
			pcData.currentSpirit = damageResult < 0 ? 0 : damageResult;
			// todo: add skill specific audio
			toggleAudio('characters', 'flyingPolypAttack', {useReverb: true, useVolume: true, soundCoords: this.coords});
			logMessage = `A hallowing cyclone winds its way from a ${creatureName} to ${pcData.name.first}, draining ${pcData.gender === 'Male' ? 'him' : 'her'} of Spirit!`;
			this._updateSpirit(creatureData, spiritCost, updateCharacters, () => {
				updateCharacters('player', pcData, pcData.id, false, false, false, () => {
					toggleAudio('characters', pcData.gender.toLowerCase() + 'Injured', {useReverb: true, useVolume: true, soundCoords: pcData.coords});
					if (updateTurnCallback) updateTurnCallback();
				});
			});
		} else {
			logMessage = `A hallowing cyclone winds its way from a ${creatureName} to ${pcData.name.first}, but ${pcData.gender === 'Male' ? 'he' : 'she'} manages to resist its effects.`;
			this._updateSpirit(creatureData, cycloneSkill.spirit, updateCharacters, updateTurnCallback);
		}
		updateLog(logMessage);
	}

	/**
	 * Shoggoth skill for doing sanity damage to all nearby pcs
	 * @param props object ({
	 *  pcData: object (all pcs' data)
	 *  creatureData: object (creature's data)
	 *  identifiedCreatures: object (part of identifiedThings from App)
	 *  updateCharacters: function (App's updateCharacters)
	 *  updateLog: function
	 *  toggleAudio: function
	 *  updateTurnCallback: function
	 * })
	 */
	piercingWail = (props) => {
		const {pcData, creatureData, identifiedCreatures, updateCharacters, updateLog, toggleAudio, updateTurnCallback} = props;
		const wailSkill = this.skills.piercingWail;
		const creatureName = identifiedCreatures[this.name] && identifiedCreatures[this.name].name ? `The ${this.name}` : 'A creature';
		this.hitRoll = diceRoll(this.hitDie);
		let hitTotal = 0;
		let defenseTotal = 0;
		let logMessage = '';
		let affectedPCs = [];

		updateLog(creatureName + ' makes an ear-splitting screeching wail that tears at the fabric of reality, threatening to drive investigators near it closer to insanity!');

		for (const individualPcData of Object.values(pcData)) {
			this.defenseRoll = diceRoll(this.defenseDie);
			hitTotal = this.mentalAcuity + this.hitRoll;
			defenseTotal = individualPcData.mentalAcuity + this.defenseRoll;

			if (hitTotal >= defenseTotal) {
				const damage = (wailSkill.damagePercent * individualPcData.startingSanity) + diceRoll(wailSkill.damage.roll) + wailSkill.damage.bonus;
				const damageResult = individualPcData.currentSanity - damage;
				individualPcData.currentSanity = damageResult < 0 ? 0 : damageResult;
				// todo: add skill specific audio
				toggleAudio('characters', 'shoggothAttack', {useReverb: true, useVolume: true, soundCoords: this.coords});
				logMessage = `${individualPcData.name.first} reels from the horrible sound and its accompanying visions of dread.`;
				affectedPCs.push(individualPcData.id);
			} else {
				logMessage = `${individualPcData.name.first} resists the wail's effects.`;
			}
			updateLog(logMessage);
		}
		this._updateSpirit(creatureData, wailSkill.spirit, updateCharacters, () => {
			updateCharacters('player', pcData, null, false, false, false, () => {
				affectedPCs.forEach(pcId => {
					setTimeout(() => {
						toggleAudio('characters', pcData[pcId].gender.toLowerCase() + 'Injured', {useReverb: true, useVolume: true, soundCoords: pcData[pcId].coords});
					}, this.reactionSoundDelay);
				});
				if (updateTurnCallback) updateTurnCallback();
			});
		});
	}

}

export default Creature;
