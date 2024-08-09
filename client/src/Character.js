import React from 'react';
import {diceRoll, deepCopy} from './Utils';
import ItemTypes from './data/itemTypes.json';
import WeaponTypes from './data/weaponTypes.json';
import Skills from './data/skills.json';

class Character extends React.Component {
	constructor(props) {
		super(props);

		this.noGunKnowledgePenalty = 0.5;
		this.hitDie = 10;
		this.defenseDie = 4;
		this.lightTimeCosts = props.lightTimeCosts;

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
		this.turnsSinceDeath = 0;
		this.isDeadOrInsane = false;
		this.startingSanity = props.startingSanity;
		this.currentSanity = props.startingSanity;
		this.startingSpirit = (this.startingHealth / 2) + (this.startingSanity / 2);
		this.currentSpirit = (this.startingHealth / 2) + (this.startingSanity / 2);
		this.skills = this._copySkillData(props.skills);
		this.inventory = this._prePopulateInv(props.playerInventoryLimit);
		this.weapons = this._populateInvInfo('weapon', props.weapons, props.equippedItems);
		this.equippedItems = {
			loadout1: {right: props.equippedItems.right, left: this._weaponIsTwoHanded(props.equippedItems.right) ? props.equippedItems.right : props.equippedItems.left},
			loadout2: {right: '', left: ''},
			armor: props.equippedItems.armor || ''
		};
		this.items = this._populateInvInfo('item', props.items, props.equippedItems);
		this.maxItems = 12;
		this.defense = this.calculateDefense(props.agility, props.equippedItems.armor ? this.items[props.equippedItems.armor].defense : 0);
		this.damageReduction = this.equippedItems.armor ? this.items[this.equippedItems.armor].damageReduction : 0;
		this.coords = {};
		this.equippedLight = props.equippedLight || null;
		this.lightRange = this.equippedLight ? this.items[this.equippedLight].range : 0;
		this.lightTime = this.equippedLight ? this.items[this.equippedLight].time : null;
		this.statuses = {};
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
			allInfo[id] = {...info, ...fullItemData[info.name], isIdentified: true};
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
			skillData[skillId] = {...Skills[skillId], level: 0};
			if (skillData[skillId].description.includes(';')) {
				skillData[skillId].description = skillData[skillId].description.split('; ').map(str => {
					return <div key={str.substring(0, 5)}>{str}</div>;
				});
			}
			if (skillData[skillId].skillType === 'create') {
				skillData[skillId].light = [this.lightTimeCosts.create];
			} else if (skillId === 'mine') {
				skillData[skillId].light = [this.lightTimeCosts.mine];
			} else if (skillId === 'expertMining') {
				skillData[skillId].light = [this.lightTimeCosts.expertMining];
			}
		});
		return skillData;
	}

	_weaponIsTwoHanded(weapon) {
		return this.weapons[weapon] && WeaponTypes[this.weapons[weapon].name].twoHanded;
	}

	/* PUBLIC */

	calculateDefense = (agility, armor) => {
		return agility + armor;
	}

	/**
	 * Carry out an attack on a creature
	 * @param props : object (
	 *  itemId: string,
	 *  itemStats: object,
	 *  targetData: object,
	 *  pcData: object,
	 *  updateCharacters: function (from App),
	 *  updateLog: function (from App),
	 *  callback: function (from App - calls toggleWeapon, _removeDeadFromTurnOrder if creature dies, then _updateActivePlayerActions)
	 * )
	 */
	attack = (props) => {
		const {itemId, itemStats, targetData, pcData, updateCharacters, updateLog, callback} = props;
		let attackTotal, hitRoll, defenseRoll, defenseTotal;
		let isHit = false;
		let damageTotal = 0;
		let rangedStrHitModifier = itemStats.usesStr ? Math.round(pcData.strength / 2) : 0;
		let updatedPcData = deepCopy(pcData);
		let updatedCreatureData = deepCopy(targetData);
		const weaponInfo = updatedPcData.weapons[itemId];
		const equippedSide = pcData.equippedItems.loadout1.right === itemId ? 'right' : 'left';
		const equippedGunType = weaponInfo.gunType;
		const noGunKnowledgeMod =
			(!pcData.skills.handgunKnowledge && equippedGunType === 'handgun') ||
			(!pcData.skills.shotgunKnowledge && equippedGunType === 'shotgun') ||
			(!pcData.skills.machineGunKnowledge && equippedGunType === 'machineGun') ? this.noGunKnowledgePenalty : 0;
		const goBallistic = itemStats.goBallistic;
		const attackFromTheShadowsMod = (pcData.id === 'thief' && pcData.skills.stealthy.active) ? pcData.skills.attackFromTheShadows.modifier[pcData.skills.attackFromTheShadows.level] : 0;
		const sacrificialStrikeSkill = itemStats.sacrificialStrike;
		const krisKnifeExpertiseMod = pcData.id === 'occultResearcher' ? pcData.skills.krisKnifeExpertise.modifier[pcData.skills.krisKnifeExpertise.level] : 0;

		if (itemStats.ranged) {
			let numOfAttacks = goBallistic ? weaponInfo.currentRounds : 1;
			if (goBallistic) {
				updateLog(`${pcData.name} goes ballistic!`);
				updatedPcData.currentSpirit -= goBallistic.spirit[goBallistic.level];
			}
			for (let attackNum = 1; attackNum <= numOfAttacks; attackNum++) {
				hitRoll = diceRoll(this.hitDie);
				defenseRoll = diceRoll(this.defenseDie);
				defenseTotal = targetData.defense + defenseRoll;
				const sureShotSkill = pcData.skills.sureShot;
				const sureShotModifier = sureShotSkill && equippedGunType ? sureShotSkill.modifier[sureShotSkill.level] : 0;
				const steadyHandSkill = pcData.skills.steadyHand;
				const steadyHandModifier = steadyHandSkill && equippedGunType === 'handgun' ? steadyHandSkill.modifier[steadyHandSkill.level] : 0;
				const goBallisticModifier = goBallistic ? goBallistic.modifier[goBallistic.level] : 0;
				let damage = 0;
				attackTotal = hitRoll + pcData.agility + steadyHandModifier + sureShotModifier + rangedStrHitModifier;
				attackTotal -= (Math.round(noGunKnowledgeMod * attackTotal) + Math.round(goBallisticModifier * attackTotal));
				isHit = attackTotal >= defenseTotal;
				if (isHit) {
					const attackDifference = attackTotal - defenseTotal;
					const damageModBasedOnAttack = attackDifference <= 0 ? 0 : Math.round(attackDifference / 2);
					damage = rangedStrHitModifier + itemStats.damage + damageModBasedOnAttack;
					damage -= targetData.damageReduction <= damage ? targetData.damageReduction : damage;
					damageTotal += damage;
				}
				weaponInfo.currentRounds--;
				if (weaponInfo.currentRounds === 0 && weaponInfo.stackable) {
					delete updatedPcData.weapons[itemId];
					updatedPcData.equippedItems.loadout1[equippedSide] = '';
				}
				updateLog(`${pcData.name} attacks with the ${weaponInfo.name}, scores ${attackTotal} to hit...and ${isHit ? `does ${damage} damage!` : `misses (${targetData.name} scored ${defenseTotal} for defense).`}`);
			}

		} else {
			hitRoll = diceRoll(this.hitDie);
			defenseRoll = diceRoll(this.defenseDie);
			defenseTotal = targetData.defense + defenseRoll;
			attackTotal = pcData.strength + Math.floor(pcData.agility / 2) + hitRoll;
			if (pcData.id === 'thief') {
				attackTotal += Math.round(attackFromTheShadowsMod * attackTotal);
			}
			if (sacrificialStrikeSkill && attackTotal < defenseTotal) {
				attackTotal = defenseTotal;
			}
			isHit = attackTotal >= defenseTotal;
			if (isHit) {
				const attackDifference = attackTotal - defenseTotal;
				const damageModBasedOnAttack = attackDifference <= 0 ? 0 : Math.round(attackDifference / 2);
				damageTotal = pcData.strength + itemStats.damage + damageModBasedOnAttack;
				if (pcData.id === 'thief') {
					damageTotal += Math.round(attackFromTheShadowsMod * damageTotal);
				} else if (pcData.id === 'occultResearcher' && itemId === 'krisKnife0') {
					damageTotal += Math.round(krisKnifeExpertiseMod * damageTotal);
				}
				if (sacrificialStrikeSkill) {
					damageTotal = Math.round(sacrificialStrikeSkill.modifier[sacrificialStrikeSkill.level] * damageTotal);
					updatedPcData.currentSpirit -= sacrificialStrikeSkill.spirit[sacrificialStrikeSkill.level];
					updatedPcData.currentHealth -= sacrificialStrikeSkill.cost.health[sacrificialStrikeSkill.level];
					updatedPcData.currentSanity -= sacrificialStrikeSkill.cost.sanity[sacrificialStrikeSkill.level];
				}
				damageTotal -= targetData.damageReduction <= damageTotal ? targetData.damageReduction : damageTotal;
			}
			const fromShadowsText = attackFromTheShadowsMod > 0 ? 'from the shadows ' : '';
			const sacrificialStrikeText = sacrificialStrikeSkill ? 'sacrifices Health and Sanity and ' : '';
			updateLog(`${pcData.name} ${sacrificialStrikeText}attacks ${fromShadowsText}with the ${weaponInfo.name}, scores ${attackTotal} to hit...and ${isHit ? `does ${damageTotal} damage!` : `misses (${targetData.name} scored ${defenseTotal} for defense).`}`);
		}

		updateCharacters('player', updatedPcData, pcData.id, false, false, false, () => {
			if (damageTotal > 0) {
				updatedCreatureData.currentHealth -= damageTotal;
				updateCharacters('creature', updatedCreatureData, targetData.id, false, false, false, callback);
			} else if (callback) {
				callback();
			}
		});
	}

	/**
	 * Carry out a health or sanity heal on a companion
	 * @param props : object (
	 *  itemId: string,
	 *  itemStats: object,
	 *  targetData: object,
	 *  pcData: object,
	 *  updateCharacters: function (from App),
	 *  updateLog: function (from App),
	 *  isChemistSkill: boolean (used for betterLivingThroughChemicals skill)
	 *  callback: function (from App - calls toggleWeapon, _removeDeadFromTurnOrder if creature dies, then _updateActivePlayerActions)
	 * )
	 */
	heal = (props) => {
		const {itemId, itemStats, targetData, pcData, updateCharacters, updateLog, isChemistSkill, callback} = props;
		const healItem = pcData.items[itemId].name;
		const targetStat = itemStats.healingType === 'health' ? 'currentHealth' : 'currentSanity';
		const startingStatValue = itemStats.healingType === 'health' ? targetData.startingHealth : targetData.startingSanity;
		let healAmount = Math.round(pcData.mentalAcuity / 2) + (itemStats.healingType === 'health' ? diceRoll(12) : diceRoll(4)) + itemStats.healingAmount;
		let updatedHealerData = deepCopy(pcData);
		// if pc is healing itself, target points to healer object
		let updatedTargetData = targetData.id !== pcData.id ? deepCopy(targetData) : updatedHealerData;
		const medicalExpertSkill = updatedHealerData.skills.medicalExpertise;

		if (medicalExpertSkill + itemStats.healingType === 'health') {
			healAmount += Math.round(medicalExpertSkill.modifier[medicalExpertSkill.level] * healAmount);
		}
		if (isChemistSkill) {
			const skillData = pcData.skills.betterLivingThroughChemicals;
			healAmount += skillData.modifier[skillData.level] * healAmount;
			updatedHealerData.currentSpirit -= skillData.spirit[skillData.level];
		}

		const healedStatValue = targetData[targetStat] + healAmount;
		updatedTargetData[targetStat] = healedStatValue > startingStatValue ? startingStatValue : healedStatValue;
		if (updatedHealerData.items[itemId].amount === 1) {
			delete updatedHealerData.items[itemId];
			const itemInvIndex = updatedHealerData.inventory.indexOf(itemId);
			updatedHealerData.inventory.splice(itemInvIndex, 1, null);
		} else {
			updatedHealerData.items[itemId].amount--;
		}
		updateCharacters('player', updatedTargetData, targetData.id, false, false, false, () => {
			const target = pcData.name === targetData.name ? (targetData.gender === 'Male' ? 'his' : 'her') : targetData.name + "'s";
			updateLog(`${pcData.name} uses ${healItem} to recover ${target} ${targetStat.substring(7)}`);
			if (targetData.id !== pcData.id) {
				updateCharacters('player', updatedHealerData, pcData.id, false, false, false, callback);
			} else {
				callback();
			}
		});
	}

	/** Profession Skills **/

	/**
	 *
	 * @param updatedPartyData
	 * @param calcPcLightChanges
	 * @param lightCost
	 * @return {boolean}
	 * @private
	 */
	_updatePcLights(updatedPartyData, calcPcLightChanges, lightCost) {
		let lightingHasChanged = false;
		for (const charData of Object.values(updatedPartyData)) {
			if (charData.equippedLight && charData.lightTime > 0) {
				const {equippedLightItem, lightTime, lightRange, hasLightChanged} = calcPcLightChanges(charData.id, lightCost);
				charData.items[charData.equippedLight] = {...equippedLightItem};
				charData.lightTime = lightTime;
				charData.lightRange = lightRange;
				lightingHasChanged = hasLightChanged;
			}
		}
		return lightingHasChanged;
	}

	/**
	 * Creates an item using materials and light (cost); enemies must not be around in order to use
	 * Called from toggleActionButton in App
	 * @param props: object {
	 *     itemType: string ('firstAidKit', 'molotovCocktail', 'torch', 'acidConcoction', 'pharmaceuticals', 'holyWater'),
	 *     activeCharId: string,
	 *     currentPcData: object,
	 *     updateCharacters: function (from App),
	 *     updateLog: function (from App),
	 *     setShowDialogProps: function (from App),
	 *     addItemToPlayerInventory: function (from App),
	 *     updateActivePlayerActions: function (from App)
	 * }
	 */
	create = (props) => {
		const {
			itemType,
			activeCharId,
			partyData,
			updateCharacters,
			updateLog,
			setShowDialogProps,
			notEnoughLightDialogProps,
			addItemToPlayerInventory,
			updateActivePlayerActions,
			calcPcLightChanges
		} = props;
		const currentPcData = partyData[activeCharId];
		const createSkill = currentPcData.skills[itemType];
		const materialCosts = createSkill.cost;
		const lightCost = this.lightTimeCosts.create;
		const itemName = createSkill.name.substring(7); // removes "Create "
		let updatedPartyData = deepCopy(partyData);
		let activeCharItems = updatedPartyData[activeCharId].items;
		let lightingHasChanged = false;
		const notEnoughMatsDialogProps = {
			dialogContent: `${currentPcData.name} doesn't have enough materials to create that item.`,
			closeButtonText: 'Ok',
			closeButtonCallback: null,
			disableCloseButton: false,
			actionButtonVisible: false,
			actionButtonText: '',
			actionButtonCallback: null,
			dialogClasses: ''
		};

		if (!currentPcData.equippedLight || currentPcData.lightTime < lightCost) {
			setShowDialogProps(true, notEnoughLightDialogProps);
			return;
		}

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
					const materialInvIndex = updatedPartyData[activeCharId].inventory.indexOf(materialItemKey);
					updatedPartyData[activeCharId].inventory.splice(materialInvIndex, 1, null);
				}
			}
		}

		// _updatePcLights modifies updatedPartyData directly
		lightingHasChanged = this._updatePcLights(updatedPartyData, calcPcLightChanges, lightCost);

		let itemId = itemType + '0';
		const itemCategory = createSkill.itemCategory;
		let itemData = {};
		if (itemCategory === 'items') {
			itemData = {...ItemTypes[itemName]};
		} else if (itemCategory === 'weapons') {
			itemData = {...WeaponTypes[itemName]};
		}
		if ((activeCharItems[itemId] || updatedPartyData[activeCharId].weapons[itemId]) && itemData.stackable) {
			if (itemCategory === 'items') {
				activeCharItems[itemId].amount++;
			} else if (itemCategory === 'weapons') {
				updatedPartyData[activeCharId].weapons[itemId].currentRounds++;
			}
		}

		updateLog(`${currentPcData.name} spends time to create a${itemType === 'acidConcoction' ? 'n' : ''} ${itemName}.`);
		// update stackable counts if applicable and remove used materials
		updateCharacters('player', updatedPartyData, null, lightingHasChanged, false, false, () => {
			// if item is new (not stackable or is stackable but id not in items/weapons), add to items/weapons and inventory
			if (!itemData.stackable || (!activeCharItems[itemId] && !updatedPartyData[activeCharId].weapons[itemId])) {
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
				addItemToPlayerInventory(itemData, itemId, activeCharId, false, true);
			// otherwise, not new item (stacked item and count was already updated), so just update actions
			} else {
				updateActivePlayerActions();
			}
		});
	}

	/**
	 *
	 * @param props: object {
	 *
	 * }
	 */
	mine = (props) => {
		const {partyData, updateCharacters, calcPcLightChanges, isExpertMining} = props;
		let updatedPartyData = deepCopy(partyData);
		const lightCost = isExpertMining ? this.lightTimeCosts.expertMining : this.lightTimeCosts.mine;
		const expertMiningSkill = partyData.archaeologist.skills.expertMining;

		// _updatePcLights modifies updatedPartyData directly
		const lightingHasChanged = this._updatePcLights(updatedPartyData, calcPcLightChanges, lightCost);
		if (isExpertMining) {
			updatedPartyData.archaeologist.currentSpirit -= expertMiningSkill.spirit[expertMiningSkill.level];
		}
		updateCharacters('player', updatedPartyData, null, lightingHasChanged, false, false);
	}

	expertMining = (props) => {
		this.mine({...props, isExpertMining: true});
	}

	/**
	 * Skill (Chemist): enhance sanity healing when using pharma
	 * Called from toggleActionButton in App
	 * @param props: object {
	 *     currentPcData: object,
	 *     updateCharacters: function (App),
	 *     updateLog: function (App),
	 *     setShowDialogProps: function (App),
	 *     updateActivePlayerActions: function (App)
	 * }
	 */
	betterLivingThroughChemicals = (props) => {
		const {currentPcData, updateCharacters, updateLog, setShowDialogProps, updateActivePlayerActions} = props;

		if (currentPcData.currentSanity === currentPcData.startingSanity) {
			const fullSanityDialogProps = {
				dialogContent: `${currentPcData.name}'s Sanity is already at its highest!`,
				closeButtonText: 'Ok',
				closeButtonCallback: null,
				disableCloseButton: false,
				actionButtonVisible: false,
				actionButtonText: '',
				actionButtonCallback: null,
				dialogClasses: ''
			};
			setShowDialogProps(true, fullSanityDialogProps);
			return;
		}

		const healProps = {
			itemId: 'pharmaceuticals0',
			itemStats: ItemTypes.Pharmaceuticals,
			isChemistSkill: true,
			targetData: currentPcData,
			pcData: currentPcData,
			updateCharacters,
			updateLog,
			callback: updateActivePlayerActions
		}
		this.heal(healProps);
	}

	/**
	 * Skill (Doctor): bring pc back to life if reduced to 0 health within last few turns
	 * Called from handleUnitClick in App
	 * @param props: object {
	 *     targetData: object
	 *     pcData: object,
	 *     updateCharacters: function (App),
	 *     updateLog: function (App),
	 *     setShowDialogProps: function (App),
	 *     callback: function
	 * }
	 */
	resuscitate = (props) => {
		const {targetData, pcData, updateCharacters, updateLog, setShowDialogProps, callback} = props;
		if (targetData.isDeadOrInsane) {
			const dialogProps = {
				dialogContent: `${targetData.name} has been dead for too long and can't be revived!`,
				closeButtonText: 'Ok',
				closeButtonCallback: null,
				disableCloseButton: false,
				actionButtonVisible: false,
				actionButtonText: '',
				actionButtonCallback: null,
				dialogClasses: ''
			}
			setShowDialogProps(true, dialogProps);
			return;
		}
		let updatedTargetData = deepCopy(targetData);
		let updatedHealerData = deepCopy(pcData);
		const resusSkillData = pcData.skills.resuscitate;
		updatedTargetData.currentHealth = resusSkillData.modifier[resusSkillData.level];
		updatedTargetData.turnsSinceDeath = 0;
		updatedHealerData.currentSpirit -= resusSkillData.spirit[resusSkillData.level];
		updateCharacters('player', updatedTargetData, targetData.id, false, false, false, () => {
			updateLog(`${pcData.name} resuscitates  ${targetData.name} back to life!`);
			updateCharacters('player', updatedHealerData, pcData.id, false, false, false, callback);
		});
	}

	/**
	 * Skill (Priest): provide buff to party, reducing sanity loss until
	 * Called from toggleActionButton in App
	 * @param props: object {
	 *     partyData: object,
	 *     currentRound: number,
	 *     updateCharacters: function (App),
	 *     updateLog: function (App),
	 *     updateActivePlayerActions: function (App)
	 * }
	 */
	comfortTheFearful = (props) => {
		const {partyData, currentRound, updateCharacters, updateLog, updateActivePlayerActions} = props;
		let updatedPartyData = deepCopy(partyData);
		const comfortSkillData = updatedPartyData.priest.skills.comfortTheFearful;

		for (const id of Object.keys(partyData)) {
			updatedPartyData[id].statuses.sanityBuff = {
				attribute: 'sanity',
				startingRound: currentRound,
				turnsLeft: comfortSkillData.turnsLeft[comfortSkillData.level],
				modifier: comfortSkillData.modifier[comfortSkillData.level]
			}
		}
		updatedPartyData.priest.currentSpirit -= comfortSkillData.spirit[comfortSkillData.level];
		updateCharacters('player', updatedPartyData, null, false, false, false, () => {
			updateLog(`${updatedPartyData.priest.name} comforts the party, easing their minds from the horrors around them!`);
			updateActivePlayerActions();
		});
	}

	/**
	 * Skill (Priest): use both actions to recover some Spirit for the party
	 * Called from toggleActionButton in App
	 * @param props: object {
	 *     partyData: object,
	 *     updateCharacters: function (App),
	 *     updateLog: function (App),
	 *     updateActivePlayerActions: function (App)
	 * }
	 */
	spiritualInspiration = (props) => {
		const {partyData, updateCharacters, updateLog, updateActivePlayerActions} = props;
		let updatedPartyData = deepCopy(partyData);
		const inspireSkillData = updatedPartyData.priest.skills.spiritualInspiration;
		const inspireModifier = inspireSkillData.modifier[inspireSkillData.level];

		for (const id of Object.keys(partyData)) {
			const modifiedSpirit = updatedPartyData[id].currentSpirit + inspireModifier;
			updatedPartyData[id].currentSpirit = modifiedSpirit > updatedPartyData[id].startingSpirit ? updatedPartyData[id].startingSpirit : modifiedSpirit;
		}
		updateCharacters('player', updatedPartyData, null, false, false, false, () => {
			updateLog(`${updatedPartyData.priest.name} inspires the party, filling them with spiritual energy!`);
			updateActivePlayerActions(true);
		});
	}

	/**
	 * Skill (Veteran): for 1 psychic attack, divert sanity damage to 2x health
	 * Called from toggleActionButton in App
	 * @param props: object {
	 *     currentPcData: object,
	 *     updateCharacters: function (App),
	 *     updateLog: function (App),
	 *     updateActivePlayerActions: function (App)
	 * }
	 */
	feelThePain = (props) => {
		const {currentPcData, updateCharacters, updateLog, updateActivePlayerActions} = props;
		let updatedPcData = deepCopy(currentPcData);
		const feelThePainSkill = updatedPcData.skills.feelThePain;

		feelThePainSkill.active = true;
		updatedPcData.currentSpirit -= feelThePainSkill.spirit[feelThePainSkill.level];
		updateCharacters('player', updatedPcData, 'veteran', false, false, false, () => {
			updateLog(`${updatedPcData.name} prepares for a psychic attack...`);
			updateActivePlayerActions();
		});
	}

	/**
	 * Skill (Thief): When active, gives bonus to Agility, allows Attack From The Shadows skill, and reduces Spirit each move/action
	 * Called from toggleActionButton in App
	 * @param props: object {
	 *     currentPcData: object,
	 *     updateCharacters: function (App),
	 *     updateLog: function (App),
	 * }
	 */
	stealthy = (props) => {
		const {currentPcData, updateCharacters, updateLog} = props;
		let updatedPcData = deepCopy(currentPcData);
		const stealthySkill = updatedPcData.skills.stealthy;

		stealthySkill.active = !stealthySkill.active;
		updateCharacters('player', updatedPcData, 'thief', false, false, false, () => {
			if (stealthySkill.active) {
				updateLog(`${updatedPcData.name} goes stealthy, slipping through the shadows...`);
			} else {
				updateLog(`${updatedPcData.name} leaves the shadows.`);
			}
		});
	}

	identifyRelic = (props) => {
		const {partyData, updateCharacters, updateLog, setShowDialogProps, notEnoughLightDialogProps, calcPcLightChanges} = props;
		let updatedPartyData = deepCopy(partyData);
		const currentPcData = updatedPartyData.occultResearcher;
		const identifyRelicSkill = currentPcData.skills.identifyRelic;
		const allItems = Object.values(currentPcData.items);
		let index = 0;
		let itemFound = false;
		let lightingHasChanged = false;
		const lightCost = identifyRelicSkill.light[identifyRelicSkill.level];
		const noRelicsDialogProps = {
			dialogContent: `There are no Relics in ${currentPcData.name}'s inventory.`,
			closeButtonText: 'Ok',
			closeButtonCallback: null,
			disableCloseButton: false,
			actionButtonVisible: false,
			actionButtonText: '',
			actionButtonCallback: null,
			dialogClasses: ''
		};

		if (!currentPcData.equippedLight || currentPcData.lightTime < lightCost) {
			setShowDialogProps(true, notEnoughLightDialogProps);
			return;
		}

		while (!itemFound && index < allItems.length) {
			const itemData = allItems[index];
			if (itemData.itemType === 'Relic' && !itemData.isIdentified) {
				itemData.isIdentified = true;
				itemFound = itemData;
			}
			index++;
		}
		if (itemFound) {
			// _updatePcLights modifies updatedPartyData directly
			lightingHasChanged = this._updatePcLights(updatedPartyData, calcPcLightChanges, lightCost);

			updatedPartyData.occultResearcher.currentSpirit -= identifyRelicSkill.spirit[identifyRelicSkill.level];
			updateCharacters('player', updatedPartyData, null, lightingHasChanged, false, false, () => {
				updateLog(`${currentPcData.name} spends time examining a Relic and identifies it as the ${itemFound.name}!`);
			});
		} else {
			setShowDialogProps(true, noRelicsDialogProps);
		}
	}

	useRelic = (props) => {
		const {itemStats, targetData, pcData, updateCharacters, updateLog, callback} = props;
		let updatedPcData = deepCopy(pcData);
		let updatedCreatureData = deepCopy(targetData);
		const relicExpertSkillMod = pcData.id === 'occultResearcher' ? pcData.skills.relicExpertise.modifier[pcData.skills.relicExpertise.level] : 0;
		let sanityReduction = 0;

		//todo: need to decide what each relic will do

		updatedPcData.currentSpirit -= itemStats.spiritCost > updatedPcData.currentSpirit ? updatedPcData.currentSpirit : itemStats.spiritCost;
		sanityReduction = itemStats.sanityCost - (relicExpertSkillMod * itemStats.sanityCost);
		updatedPcData.currentSanity -= sanityReduction > updatedPcData.currentSanity ? updatedPcData.currentSanity : sanityReduction;

		if (itemStats.result === 'remove') {
			updatedCreatureData.currentHealth = 0;
			updatedCreatureData.isRemoved = true;
		}

		updateCharacters('player', updatedPcData, pcData.id, false, false, false, () => {
		    updateLog(`${pcData.name} uses the ${itemStats.name}, wreaking havoc on the ${targetData.name} but driving ${pcData.gender === 'Male' ? 'him' : 'her'}self closer to madness!`);
			updateCharacters('creature', updatedCreatureData, targetData.id, false, false, false, callback);
		});
	}
}

export default Character;
