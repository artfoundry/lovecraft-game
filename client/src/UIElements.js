import React, {useState} from 'react';
import {deepCopy, convertObjIdToClassId, notEnoughSpaceInInventory, handleItemOverDropZone} from './Utils';
import {Music} from './Audio';

function CharacterControls(props) {
	const currentPCdata = props.playerCharacters[props.characterId];
	const equippedItems = props.equippedItems.loadout1;
	const invItems = props.invItems;
	const pcSkills = currentPCdata.skills;
	const statuses = [];
	const actionableItems = {
		weapons: [],
		medicine: [],
		skills: [],
		misc: []
	};
	let actionButtonCount = 0;
	const actionButtonMax = 6;
	const [skillPaginationNum, updateSkillPageNum] = useState(1);
	const shouldActionButtonShow = () => {
		return (actionButtonCount <= actionButtonMax && skillPaginationNum === 1) ||
			(actionButtonCount > actionButtonMax && skillPaginationNum === 2) ||
			(actionButtonCount > (actionButtonMax * 2) && skillPaginationNum === 3);
	}

	const handleWeaponClick = (weapon, reloading = false, isQuickReload = false) => {
		if (reloading) {
			props.reloadGun(weapon.weaponId, isQuickReload);
		} else {
			props.toggleActionButton(props.characterId, weapon.weaponId, weapon.weaponName, 'weapon');
		}
	};
	const hasExtraAmmo = props.checkForExtraAmmo(currentPCdata);
	let actionButtonState = '';

	// add all equipped weapons to actionableItems.weapons
	for (const itemId of Object.values(equippedItems)) {
		// need this check for two-handed weapons, since both hands list the same weaponId
		const existingWeaponIndex = actionableItems.weapons.findIndex(weapon => weapon.weaponId === itemId);
		if (currentPCdata.weapons[itemId] && existingWeaponIndex === -1) {
			const weaponInfo = currentPCdata.weapons[itemId];
			if (weaponInfo.ranged) {
				const weaponButtonIndex = actionableItems.weapons.findIndex(listItem => listItem.weaponName === weaponInfo.name);
				if (weaponInfo.gunType) {
					actionableItems.weapons.push({
						weaponId: itemId,
						gunType: weaponInfo.gunType,
						weaponName: weaponInfo.name,
						isGun: true,
						ammo: weaponInfo.currentRounds,
						fullyLoaded: weaponInfo.rounds
					});
				// check to make sure this stackable weapon isn't already in the controls and has some ammo
				} else if (weaponButtonIndex === -1 && weaponInfo.stackable && weaponInfo.currentRounds > 0) {
					actionableItems.weapons.push({
						weaponId: itemId,
						weaponName: weaponInfo.name,
						ammo: weaponInfo.currentRounds
					});
				// stackable weapon is already added, so we just need to update its ammo count (this is in case there are multiple stacks under different IDs)
				} else if (weaponButtonIndex >= 0 && weaponInfo.stackable) {
					actionableItems.weapons[weaponButtonIndex].ammo += weaponInfo.currentRounds;
				}
			} else {
				actionableItems.weapons.push({
					weaponId: itemId,
					weaponName: weaponInfo.name,
					ammo: null
				});
			}
		}
	}

	// add all inv medicine items to actionableItems.medicine or Relics to actionableItems.misc
	for (const [itemId, itemInfo] of Object.entries(invItems)) {
		if (itemInfo.itemType === 'Medicine') {
			actionableItems.medicine.push({
				itemId,
				name: itemInfo.name,
				amount: itemInfo.amount
			});
		} else if (itemInfo.itemType === 'Relic' && itemInfo.useType === 'active') {
			actionableItems.misc.push({
				itemId,
				name: itemInfo.name,
				itemType: itemInfo.itemType,
				hasTarget: itemInfo.hasTarget,
				sanityCost: itemInfo.sanityCost,
				spiritCost: itemInfo.spiritCost
			});
		}
	}

	// add all action or create skills to actionableItems.skills
	for (const [skillId, skillInfo] of Object.entries(pcSkills)) {
		if ((skillInfo.skillType === 'create' || skillInfo.skillType === 'active') &&
			((skillId !== 'mine' && skillId !== 'expertMining') || ((skillId === 'mine' || skillId === 'expertMining') && props.mineablesNextToPc.length > 0)) &&
			(!skillInfo.mustBeOutOfDanger || (skillInfo.mustBeOutOfDanger && props.threatList.length === 0)))
		{
			actionableItems.skills.push({
				skillId,
				name: skillInfo.name,
				skillType: skillInfo.skillType,
				hasTarget: skillInfo.hasTarget,
				requiresEquippedGunType: skillInfo.requiresEquippedGunType,
				requiresEquippedItem: skillInfo.requiresEquippedItem,
				requiresItem: skillInfo.requiresItem,
				requiresEquippedMeleeWeapon: skillInfo.requiresEquippedMeleeWeapon,
				requiresBothActions: skillInfo.requiresBothActions,
				mustNotHaveLightEquipped: skillInfo.mustNotHaveLightEquipped,
				spirit: skillInfo.spirit,
				level: skillInfo.level,
				active: skillInfo.active
			});
		}
	}
	//todo: could add block here for archaeologist to reorder actionableItems.skills array
	// to ensure expertMining skill and mine skill are displayed next to each other in control bar

	// add misc actions to actionableItems.misc
	if (props.mapObjectsOnPcTiles.length > 0) {
		actionableItems.misc.push('pickup');
	}
	if (props.containersNextToPc.length > 0) {
		actionableItems.misc.push('open-container');
	}
	if ((currentPCdata.equippedLight && (currentPCdata.equippedLight.includes('lantern') || currentPCdata.equippedLight.includes('torch'))) &&
		currentPCdata.lightTime < currentPCdata.items[currentPCdata.equippedLight].maxTime && currentPCdata.items.oil0)
	{
		actionableItems.misc.push('refill');
	}

	const weaponButtons = (
		<div className='weapon-buttons-container'>
			{actionableItems.weapons.map(weapon => {
				let button;
				if (weapon.isGun) {
					actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0 || weapon.ammo === 0) ? 'button-inactive' :
						(props.isActiveCharacter && props.actionButtonSelected && props.actionButtonSelected.characterId === props.characterId && props.actionButtonSelected.buttonId === weapon.weaponId) ? 'button-selected': '';
					const reloadButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0 || props.actionButtonSelected || weapon.ammo === weapon.fullyLoaded || !hasExtraAmmo) ? 'button-inactive' :
						(props.isActiveCharacter && props.actionButtonSelected && props.actionButtonSelected.characterId === props.characterId && props.actionButtonSelected.buttonId === weapon.weaponId) ? 'button-selected': '';
					actionButtonCount += 2;
					button = (
						<div key={weapon.weaponId} className={`action-button-pair ${shouldActionButtonShow() ? '' : 'hide'}`}>
							<div
								className={`action-button ${convertObjIdToClassId(weapon.weaponId)}-action ${actionButtonState}`}
								onClick={() => {
									handleWeaponClick(weapon);
								}}
							>{weapon.ammo}</div>
							<div
								className={`action-button gun-reload-icon ${convertObjIdToClassId(weapon.weaponId)}-action ${reloadButtonState}`}
								onClick={() => {
									handleWeaponClick(weapon, true);
								}}
							></div>
						</div>
					);
				} else {
					actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0 || (weapon.ammo === 0 && !hasExtraAmmo)) ? 'button-inactive' :
						(props.isActiveCharacter && props.actionButtonSelected && props.actionButtonSelected.characterId === props.characterId && props.actionButtonSelected.buttonId === weapon.weaponId) ? 'button-selected': '';
					actionButtonCount++;
					button = (
						<div
							key={weapon.weaponId}
							className={`action-button ${shouldActionButtonShow() ? '' : 'hide'} ${convertObjIdToClassId(weapon.weaponId)}-action ${actionButtonState} ${weapon.ammo === 0 ? 'gun-reload-icon' : ''}`}
							onClick={() => {
								handleWeaponClick(weapon);
							}}
						>{weapon.ammo || ''}</div>
					);
				}
				return button;
			})}
		</div>
	);

	const skillButtons = (
		<div className='skill-buttons-container'>
			{actionableItems.skills.map(skill => {
				let button = null;
				const leftWeapon = currentPCdata.weapons[equippedItems.left];
				const rightWeapon = currentPCdata.weapons[equippedItems.right];
				const leftWeaponNeedsReloading = leftWeapon && leftWeapon.gunType && leftWeapon.currentRounds < leftWeapon.rounds;
				const rightWeaponNeedsReloading = rightWeapon && rightWeapon.gunType && rightWeapon.currentRounds < rightWeapon.rounds;
				const requiresItemOrWeapon = skill.requiresItem || skill.requiresEquippedGunType || skill.requiresEquippedItem || skill.requiresEquippedMeleeWeapon;
				const hasNeededItem =
					(skill.requiresItem && invItems[skill.requiresItem]) ||
					(skill.requiresEquippedGunType && ((leftWeapon && skill.requiresEquippedGunType.includes(leftWeapon.gunType)) || (rightWeapon && skill.requiresEquippedGunType.includes(rightWeapon.gunType)))) ||
					(skill.requiresEquippedItem && (equippedItems.left.includes(skill.requiresEquippedItem) || equippedItems.right.includes(skill.requiresEquippedItem))) ||
					(skill.requiresEquippedMeleeWeapon && ((leftWeapon && !leftWeapon.ranged) || (rightWeapon && !rightWeapon.ranged)));
				const hasAmmoForReloadSkill = hasExtraAmmo && hasNeededItem && (leftWeaponNeedsReloading || rightWeaponNeedsReloading);
				const leftGunHasAmmo = leftWeapon && leftWeapon.currentRounds > 0;
				const rightGunHasAmmo = rightWeapon && rightWeapon.currentRounds > 0;
				const gunIsLoaded = skill.requiresEquippedGunType && hasNeededItem && (leftGunHasAmmo || rightGunHasAmmo);
				const requiresActionsRemaining = skill.name !== 'Quick Reload' && skill.name !== 'Mine' && skill.name !== 'Expert Mining';
				// all active and only active skills require spirit
				const hasEnoughSpirit = skill.spirit && currentPCdata.currentSpirit >= skill.spirit[skill.level];
				actionButtonState =
					(!props.isActiveCharacter ||
					(props.actionsRemaining === 0 && requiresActionsRemaining) ||
					(skill.spirit && !hasEnoughSpirit) || (requiresItemOrWeapon && !hasNeededItem) ||
					(skill.name === 'Quick Reload' && !hasAmmoForReloadSkill) ||
					(skill.name === 'Go Ballistic' && !gunIsLoaded) ||
					(skill.name === 'Feel The Pain' && skill.active) ||
					(skill.name === 'Stealthy' && !props.inTacticalMode) ||
					(skill.mustNotHaveLightEquipped && currentPCdata.equippedLight) ||
					(skill.name === 'Disarm Trap' && props.trapsNextToPc.length === 0) ||
					(skill.requiresBothActions && props.actionsRemaining < 2)) ? 'button-inactive' :
					(props.isActiveCharacter &&
					((props.actionButtonSelected &&
					props.actionButtonSelected.characterId === props.characterId &&
					props.actionButtonSelected.buttonId === skill.skillId && skill.hasTarget) ||
					(skill.name === 'Stealthy' && skill.active) ||
					(skill.name === 'Go Ballistic' && props.skillModeActive === 'goBallistic') ||
					(skill.name === 'Sacrificial Strike' && props.skillModeActive === 'sacrificialStrike'))) ? 'button-selected': '';
				let skillClass = `${convertObjIdToClassId(skill.skillId)}-action`;
				actionButtonCount++;
				button = (
					<div key={skill.skillId} className={`action-button ${shouldActionButtonShow() ? '' : 'hide'} ${skillClass} ${actionButtonState}`} onClick={(evt) => {
						if (skill.name === 'Quick Reload') {
							const setWeapon = (id) => {
								const weapon = {weaponId: id};
								handleWeaponClick(weapon, true, true);
							}
							if (leftWeaponNeedsReloading && rightWeaponNeedsReloading) {
								const dialogProps = {
									dialogContent: 'Which weapon do you want to reload?',
									closeButtonText: `${leftWeapon.name}`,
									closeButtonCallback: () => {
										setWeapon(equippedItems.left);
									},
									disableCloseButton: false,
									actionButtonVisible: true,
									actionButtonText: `${rightWeapon.name}`,
									actionButtonCallback: () => {
										setWeapon(equippedItems.right);
									},
									dialogClasses: ''
								};
								props.setShowDialogProps(true, dialogProps);
							} else {
								leftWeaponNeedsReloading ? setWeapon(equippedItems.left) : setWeapon(equippedItems.right);
							}
						} else if (skill.name === 'Go Ballistic' || skill.name === 'Sacrificial Strike') {
							const weapon = skill.name === 'Go Ballistic' ? {
								weaponId: leftGunHasAmmo ? equippedItems.left : equippedItems.right,
								weaponName: leftGunHasAmmo ? leftWeapon.name : rightWeapon.name
							} : {weaponId: 'krisKnife0', weaponName: 'Kris Knife'};
							const handleWeaponClickCallback = () => {
								handleWeaponClick(weapon);
							};
							if (props.skillModeActive) {
								props.toggleActionButton('', '', '', '', null);
							} else {
								props.toggleActionButton(props.characterId, skill.skillId, skill.name, 'skill', handleWeaponClickCallback);
							}
						} else if (skill.skillId === 'expertMining' || skill.skillId === 'mine') {
							if (props.hasEnoughLight) {
								props.setMapObjectSelected(props.mineablesNextToPc, evt, true, {miningAction: skill.skillId});
							} else {
								props.setShowDialogProps(true, props.notEnoughLightDialogProps);
							}
						} else if (skill.skillId === 'disarmTrap') {
							props.toggleActionButton(props.characterId, skill.skillId, skill.name, 'skill', null, props.trapsNextToPc);
						} else {
							props.toggleActionButton(props.characterId, skill.skillId, skill.name, 'skill');
						}
					}}></div>
				);
				return button;
			})}
		</div>
	);

	const medicineButtons = (
		<div className='item-buttons-container'>
			{actionableItems.medicine.map(item => {
				const lastItemIndex = actionableItems.medicine.findLastIndex(match => match.name === item.name);
				const itemCount = actionableItems.medicine[lastItemIndex].amount;
				let button = null;
				if (item.amount === itemCount) {
					actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0) ? 'button-inactive' :
						(props.isActiveCharacter && props.actionButtonSelected && props.actionButtonSelected.characterId === props.characterId && props.actionButtonSelected.buttonId === item.itemId) ? 'button-selected': '';
					actionButtonCount++;
					button = (
						<div key={item.itemId} className={`action-button ${shouldActionButtonShow() ? '' : 'hide'} ${convertObjIdToClassId(item.itemId)}-action ${actionButtonState}`} onClick={() => {
							props.toggleActionButton(props.characterId, item.itemId, item.name, 'item');
						}}>{itemCount}</div>
					);
				}
				return button;
			})}
		</div>
	);

	const miscButtons = (
		<div className='misc-action-buttons-container'>
			{actionableItems.misc.map((item, index) => {
				let button = null;
				actionButtonState = (!props.isActiveCharacter ||
					props.actionsRemaining === 0 ||
					(item.spiritCost && currentPCdata.currentSpirit < item.spiritCost)) ? 'button-inactive' :
					(props.actionButtonSelected &&
					props.actionButtonSelected.characterId === props.characterId &&
					(props.actionButtonSelected.buttonId === item.itemId && item.hasTarget)) ? 'button-selected' : '';
				actionButtonCount++;
				if (item === 'pickup') {
					button = <div
						key={item + index}
						className={`action-button ${item}-action ${shouldActionButtonShow() ? '' : 'hide'} ${actionButtonState}`}
						onClick={(evt) => props.setMapObjectSelected(props.mapObjectsOnPcTiles, evt, true)}></div>;
				} else if (item === 'open-container') {
					button = <div
						key={item + index}
						className={`action-button ${item}-action ${shouldActionButtonShow() ? '' : 'hide'} ${actionButtonState}`}
						onClick={(evt) => props.setMapObjectSelected(props.containersNextToPc, evt, true)}></div>;
				} else if (item === 'refill') {
					button = <div
						key={item + index}
						className={`action-button ${item}-action ${shouldActionButtonShow() ? '' : 'hide'} ${actionButtonState}`}
						onClick={props.refillLight}></div>;
				} else if (typeof item === 'object' && item.itemType === 'Relic') {
					button = <div
						key={item + index}
						className={`action-button ${convertObjIdToClassId(item.itemId)}-action ${shouldActionButtonShow() ? '' : 'hide'} ${actionButtonState}`}
						onClick={(evt) => props.toggleActionButton(props.characterId, item.itemId, item.name, 'item')}></div>;
				}
				return button;
			})}
		</div>
	);

	if (currentPCdata.levelUpPoints > 0) {
		statuses.push('level-up');
	}
	for (const statusType of Object.keys(currentPCdata.statuses)) {
		statuses.push(statusType);
	}
	const statusIcons = (
		<span className={'character-status-icons'}>
			{statuses.map(status => {
				return <span key={status} className={`character-status-icon ${convertObjIdToClassId(status)}-status-icon`}></span>
			})}
		</span>
	);

	const displayCharName = !props.screenData.isSmall || (props.screenData.isSmall && props.characterId === props.selectedControlTab);
	const healthLevel = (currentPCdata.currentHealth / currentPCdata.startingHealth) * 100;
	const sanityLevel = (currentPCdata.currentSanity / currentPCdata.startingSanity) * 100;
	const spiritLevel = (currentPCdata.currentSpirit / currentPCdata.startingSpirit) * 100;
	const skillPageTotal = Math.ceil(actionButtonCount / actionButtonMax);
	// if a button has been removed and was the only button on that buttons page, reduce current page num
	if (skillPageTotal < skillPaginationNum && skillPageTotal > 0) {
		updateSkillPageNum(skillPageTotal);
	}
	return (
		<div
			id={`${(props.screenData.isSmall && props.characterId === props.selectedControlTab) ? 'control-bar-tab-1' : ''}`}
			className={`control-bar-tab-container ${props.isActiveCharacter ? 'active-character' : ''} ${props.showDialog ? 'no-click' : ''}`}
			onDragOver={(evt) => handleItemOverDropZone(evt)}
			onDrop={(evt) => props.dropItemToPC(evt, props.characterId)}>

			<div className='control-bar-tab' onClick={() => props.setSelectedControlTab(props.characterId)}>
				<span className='character-name font-fancy'>
					<span className={`control-bar-tab-icon ${convertObjIdToClassId(props.characterId)}`}></span>
					{displayCharName ? props.characterName : ''}
				</span>
				{statusIcons}
			</div>
			<div id='control-bar-statuses-container'>
				<div className='control-bar-status-bars'>
					<div className='control-bar-status-row'>
						<div className='status-bar-icon heart-icon'></div>
						<div className='status-bar-container'>
							<div id='status-bar-health' className='status-bar-level' style={{width: healthLevel + '%'}}></div>
						</div>
					</div>
					<div className='control-bar-status-row'>
						<div className='status-bar-icon brain-icon'></div>
						<div className='status-bar-container'>
							<div id='status-bar-sanity' className='status-bar-level' style={{width: sanityLevel + '%'}}></div>
						</div>
					</div>
					<div className='control-bar-status-row'>
						<div className='status-bar-icon spirit-icon'></div>
						<div className='status-bar-container'>
							<div id='status-bar-spirit' className='status-bar-level' style={{width: spiritLevel  + '%'}}></div>
						</div>
					</div>
				</div>
				{props.inTacticalMode &&
				<div className='control-bar-actions-moves'>
					<div id='control-bar-moves-title'>Moves: </div><div id='control-bar-moves-value'>{props.isActiveCharacter ? props.movesRemaining : '0'}</div>
					<div id='control-bar-actions-title'>Actions: </div><div id='control-bar-actions-value'>{props.isActiveCharacter ? props.actionsRemaining : '0'}</div>
				</div>}
			</div>
			<div
				id={`char-control-${props.characterId}`}
				className={`control-bar-buttons-container ${(props.screenData.isSmall && props.characterId !== props.selectedControlTab) ? 'hide' : ''}`}>
				{(actionButtonCount > actionButtonMax) && (skillPaginationNum > 1) &&
					<div className='action-button action-button-scroll' onClick={() => updateSkillPageNum(skillPaginationNum - 1)}>⬅</div>
				}
				{weaponButtons}
				{skillButtons}
				{medicineButtons}
				{miscButtons}
				{(actionButtonCount > actionButtonMax) && (skillPageTotal > 1) && (skillPaginationNum < skillPageTotal) &&
				<div className='action-button arrow-button-right action-button-scroll' onClick={() => updateSkillPageNum(skillPaginationNum + 1)}>⬅</div>
				}
			</div>
		</div>
	);
}

function CharacterInfoPanel(props) {
	const [levelUpPointAllocations, updatePointAllocations] = useState({stats: {}, skills: {}});
	const updateLevelPointAlloc = (statOrSkill, statOrSkillName, action) => {
		let updateData = deepCopy(levelUpPointAllocations);
		if (levelUpPointAllocations[statOrSkill][statOrSkillName]) {
			updateData[statOrSkill][statOrSkillName] = action === 'add' ? levelUpPointAllocations[statOrSkill][statOrSkillName] + 1 : levelUpPointAllocations[statOrSkill][statOrSkillName] - 1;
		} else {
			updateData[statOrSkill][statOrSkillName] = 1;
		}
		updatePointAllocations(updateData);
	}
	const [availableLevelUpPoints, updateLevelUpPoints] = useState(props.characterInfo.levelUpPoints);
	const skillList = Object.entries(props.characterInfo.skills).map(skillInfo => {
		const skillId = skillInfo[0];
		const skill = skillInfo[1];
		// list of components if they exist
		const compList = skill.cost ? Object.entries(skill.cost).map(cost => {
			const compKey = cost[0];
			let compVal = cost[1];
			if (Array.isArray(compVal)) {
				compVal = compVal[skill.level + (levelUpPointAllocations.skills[skillId] || 0)];
			}
			const compName = compKey.substring(0,1).toUpperCase() + compKey.substring(1, compKey.length);
			return <li key={compName + '-' + compVal} className='char-info-skill-component-list-item'>{compName}: {compVal}</li>;
		}) : null;
		const skillModValue = skill.modifier ? skill.modifier[skill.level + (levelUpPointAllocations.skills[skillId] || 0)] : null;
		// if modifier is between 1 and -1 and is a decimal, it needs to be displayed as a percentage
		const modifier = skillModValue && ((skillModValue < 1) && (skillModValue > -1) && (skillModValue - Math.floor(skillModValue)) !== 0) ? skillModValue * 100 : skillModValue;
		return (
			<div key={skill.name + Math.random()}
			     className={`char-info-skills-skill-container${(props.characterInfo.levelUpPoints > 0 && skill.level < skill.maxLevel) ? ' highlight-row' : ''}`}>
				<div className='char-info-skill-icon-column'>
					<div className={`char-info-skill-icon skill-icon-${convertObjIdToClassId(skillId)}`}></div>
				</div>
				<div>
					<div className='char-info-skill-name'>{skill.name}</div>
					<div>{skill.description}</div>
					{skill.maxLevel > 0 ? <div>Skill level: {skill.level + 1 + (levelUpPointAllocations.skills[skillId] || 0)} (Max level: {skill.maxLevel + 1})</div> : null}
					{skill.modifier ? <div>Effect: {skill.modType}{modifier}{skill.affects}</div> : null}
					{skill.turnsLeft ? <div>Number of turns effect lasts: {skill.turnsLeft[skill.level]}</div>: null}
					{skill.mustBeOutOfDanger ? <div>Can't be used during combat</div> : null}
					{skill.cost && skill.name !== 'Sacrificial Strike' ? <div>Required components: {compList}</div> : null}
					{skill.cost && skill.name === 'Sacrificial Strike' ? <div>Cost: {compList}</div> : null}
					{skill.light ? <div>Required time (light): {skill.light[skill.level + (levelUpPointAllocations.skills[skillId] || 0)]}</div> : null}
					{skill.spirit ? <div>Required Spirit: {skill.spirit[skill.level + (levelUpPointAllocations.skills[skillId] || 0)]}</div> : null}
					{skill.requiresEquippedGunType ? <div>Requires equipped {skill.requiresEquippedGunType}</div> : null}
					{skill.requiresEquippedMeleeWeapon ? <div>Requires equipped melee weapon</div> : null}
					{skill.requiresEquippedItem ? <div>Requires equipped {skill.requiresEquippedItem}</div> : null}
				</div>
				{props.characterInfo.levelUpPoints > 0 && skill.maxLevel > skill.level &&
					<div className='level-up-button-container'>
						<span className={`general-button level-up-button${availableLevelUpPoints === 0 ? ' button-disabled' : ''}`} onClick={() => {
							updateLevelPointAlloc('skills', skillId, 'add');
							updateLevelUpPoints(availableLevelUpPoints - 1);
						}}>+</span>
						<span className={`general-button level-up-button${!levelUpPointAllocations.skills[skillId] ? ' button-disabled' : ''}`} onClick={() => {
							updateLevelPointAlloc('skills', skillId, 'subtract');
							updateLevelUpPoints(availableLevelUpPoints + 1);
						}}>-</span>
					</div>
				}
			</div>
		);
	});
	const equippedLight = props.characterInfo.items[props.characterInfo.equippedLight];
	const equippedItems = props.characterInfo.equippedItems;
	const equippedIsTwoHanded = equippedItems.loadout1.right && equippedItems.loadout1.right === equippedItems.loadout1.left;
	const inventoryItems = [...props.characterInventoryIds];
	const dragItem = (evt) => {
		const itemId = evt.target.id.includes('-leftHand') ? evt.target.id.slice(0, evt.target.id.indexOf('-leftHand')) : evt.target.id;
		const selectedChar = props.characterInfo;
		const draggedItem = selectedChar.items[itemId] || selectedChar.weapons[itemId];
		const draggedItemData = {
			sourcePC: selectedChar.id,
			sourceLoc: evt.target.parentElement.id, //only used if being dragged from inv (not from equipped)
			sourceClasses: evt.target.parentElement.className
		};
		props.setObjectSelected(draggedItem, draggedItemData);
	}
	const itemsIntoElements = (
		<div className='char-info-inv-items'>
			{inventoryItems.map((itemId, index) => {
				const itemInfo = props.characterInfo.weapons[itemId] || props.characterInfo.items[itemId];
				return (
					<div
						id={'invBox' + index}
						key={'invBox' + index}
						className='char-info-inv-item-box'
						onDragOver={(evt) => {handleItemOverDropZone(evt)}}
						onDrop={(evt) => { props.dropItemToInv(evt);}}
					>
						{itemId &&
							<div
								id={itemId}
								className={`inv-object ${convertObjIdToClassId(itemId)}-inv`}
								draggable={true}
								onDragStart={(evt) => {dragItem(evt, itemId)}}
								onClick={(evt) => {
									props.setObjectSelected({...itemInfo, id: itemId}, null);
									props.setObjectPanelDisplayOption(true, evt);
								}}
							>{itemInfo.currentRounds || itemInfo.amount || ''}</div>
						}
					</div>
				);
			})}
		</div>
	);
	const numItemsInLoadout1 = equippedIsTwoHanded || (equippedItems.loadout1.right && !equippedItems.loadout1.left) || (!equippedItems.loadout1.right && equippedItems.loadout1.left) ? 1 :
		(equippedItems.loadout1.right && equippedItems.loadout1.left && equippedItems.loadout1.right !== equippedItems.loadout1.left) ? 2 : 0;
	const numItemsInLoadout2 = (equippedItems.loadout2.right && equippedItems.loadout2.left && equippedItems.loadout2.right === equippedItems.loadout2.left) ||
		(equippedItems.loadout2.right && !equippedItems.loadout2.left) || (!equippedItems.loadout2.right && equippedItems.loadout2.left) ? 1 :
		(equippedItems.loadout2.right && equippedItems.loadout2.left && equippedItems.loadout2.right !== equippedItems.loadout2.left) ? 2 : 0;
	const weaponsPossessed = props.characterInfo.weapons;
	const itemsPossessed = props.characterInfo.items;
	const rightEquippedItemInfo = weaponsPossessed[equippedItems.loadout1.right] || itemsPossessed[equippedItems.loadout1.right];
	const leftEquippedItemInfo = weaponsPossessed[equippedItems.loadout1.left] || itemsPossessed[equippedItems.loadout1.left];
	const rightItemAmount = (rightEquippedItemInfo && rightEquippedItemInfo.amount) ? rightEquippedItemInfo.amount : (rightEquippedItemInfo && rightEquippedItemInfo.currentRounds) ? rightEquippedItemInfo.currentRounds : '';
	const leftItemAmount = (leftEquippedItemInfo && leftEquippedItemInfo.amount) ? leftEquippedItemInfo.amount : (leftEquippedItemInfo && leftEquippedItemInfo.currentRounds) ? leftEquippedItemInfo.currentRounds : '';
	const [activeTab, updateActiveTab] = useState('inv');

	return (
		<div className={`character-info-container ui-panel ${props.showDialog ? 'no-click' : ''}`}>
			<div className='char-info-header'>
				<h3 className='font-fancy'>{props.characterInfo.name}</h3>
				<div className='general-button' onClick={() => props.updateUnitSelectionStatus(props.characterInfo.id, 'player')}>X</div>
			</div>

			<div className='char-info-all-contents-container'>
				<div className='char-info-tabs-container'>
					<div className={`char-info-tab ${activeTab === 'inv' ? 'char-info-active-tab' : ''}`}
					     onClick={() => updateActiveTab('inv')}>Inventory</div>
					<div className={`char-info-tab ${activeTab === 'stats' ? 'char-info-active-tab' : ''}`}
					     onClick={() => updateActiveTab('stats')}>Attributes
						{props.characterInfo.levelUpPoints > 0 &&
							<span className='character-status-icon level-up-status-icon'></span>
						}
					</div>
					<div className={`char-info-tab ${activeTab === 'skills' ? 'char-info-active-tab' : ''}`}
					     onClick={() => updateActiveTab('skills')}>Skills
						{props.characterInfo.levelUpPoints > 0 &&
							<span className='character-status-icon level-up-status-icon'></span>
						}
					</div>
				</div>

				<div className={`char-info-inv-container ${activeTab !== 'inv' ? 'hide' : ''}`}>
					<div className='char-info-equipped-light'>Equipped Light: {props.characterInfo.equippedLight ? `${equippedLight.name} (Time left: ${equippedLight.time})`: 'none'}</div>

					<div className='char-info-doll-container'>
						<div className='char-info-paper-doll'></div>
						<div className='char-info-doll-boxes-container'>
							<div
								className='char-info-paper-doll-body char-info-paper-doll-box'
								onDragOver={(evt) => {handleItemOverDropZone(evt)}}
								onDrop={(evt) => props.dropItemToEquipped(evt)}
							>
								{(equippedItems.armor &&
									<div
										id={equippedItems.armor ? equippedItems.armor : 'body'}
										className={`inv-object ${convertObjIdToClassId(equippedItems.armor)}-inv`}
										draggable={true}
										onDragStart={(evt) => {dragItem(evt, equippedItems.armor)}}
										onClick={(evt) => {
											props.setObjectSelected({...itemsPossessed[equippedItems.armor], id: equippedItems.armor}, null);
											props.setObjectPanelDisplayOption(true, evt);
										}}
									></div>) || 'Body'}
							</div>

							<div
								className='char-info-paper-doll-right-arm char-info-paper-doll-box'
								onDragOver={(evt) => {handleItemOverDropZone(evt)}}
								onDrop={(evt) => props.dropItemToEquipped(evt)}
							>
								{(equippedItems.loadout1.right &&
									<div
										id={equippedItems.loadout1.right ? equippedItems.loadout1.right : 'right-hand'}
										className={`inv-object ${convertObjIdToClassId(equippedItems.loadout1.right)}-inv`}
										draggable={true}
										onDragStart={(evt) => {dragItem(evt, equippedItems.loadout1.right)}}
										onClick={(evt) => {
											props.setObjectSelected({...rightEquippedItemInfo, id: equippedItems.loadout1.right}, null);
											props.setObjectPanelDisplayOption(true, evt);
										}}
									>{equippedItems.loadout1.right ? rightItemAmount : ''}</div>) || 'Right Hand'}
							</div>

							<div
								className='char-info-paper-doll-left-arm char-info-paper-doll-box'
								onDragOver={(evt) => {handleItemOverDropZone(evt)}}
								onDrop={(evt) => props.dropItemToEquipped(evt)}
							>
								{(equippedItems.loadout1.left &&
									<div
										id={equippedIsTwoHanded ? equippedItems.loadout1.left + '-leftHand' :
											equippedItems.loadout1.left ? equippedItems.loadout1.left : 'left-hand'}
										className={`inv-object ${convertObjIdToClassId(equippedItems.loadout1.left)}-inv`}
										draggable={true}
										onDragStart={(evt) => {dragItem(evt, equippedItems.loadout1.left)}}
										onClick={(evt) => {
											props.setObjectSelected({...leftEquippedItemInfo, id: equippedItems.loadout1.left}, null);
											props.setObjectPanelDisplayOption(true, evt);
										}}
									>{equippedItems.loadout1.left ? leftItemAmount : ''}</div>) || 'Left Hand'}
							</div>
						</div>
					</div>

					<div className='char-info-equip-toggle-button general-button' onClick={() => {
						if (!notEnoughSpaceInInventory(numItemsInLoadout1, numItemsInLoadout2, props.characterInfo)) {
							props.switchEquipment(props.characterInfo.id)
						} else {
							props.setShowDialogProps(true, props.notEnoughSpaceDialogProps);
						}
					}}>Switch equipment</div>

					<div>
						<div className='char-info-item-drop-zone'
						     onDragOver={(evt) => {handleItemOverDropZone(evt)}}
						     onDrop={(evt) => {props.setHasObjBeenDropped({objHasBeenDropped: true, evt})}}
						></div>
						<span>Drag item here to drop</span>
					</div>

					{itemsIntoElements}
				</div>

				<div className={`char-info-stats-container ${activeTab !== 'stats' ? 'hide' : ''}`}>
					{props.characterInfo.levelUpPoints > 0 &&
						<div className='level-up-header highlight-row'>
							<div className='character-stat-text'>Investigator has increased in expertise.</div>
							<div className='character-stat-text'>
								<span>Points to add: {availableLevelUpPoints}</span>
								<span className={`general-button${availableLevelUpPoints === props.characterInfo.levelUpPoints ? ' button-disabled' : ''}`}
								      onClick={() => {
										props.assignLevelUpPoints(props.characterInfo.id, levelUpPointAllocations);
										updatePointAllocations({stats: {}, skills: {}});
									  }}
								>Save</span>
							</div>
						</div>
					}
					<div className='character-stat-text'>Profession: {props.characterInfo.profession}</div>
					<div className='character-stat-text'>Gender: {props.characterInfo.gender}</div>
					<div className='character-stat-text'>Health: {props.characterInfo.currentHealth} / {props.characterInfo.startingHealth}</div>
					<div className='character-stat-text'>Sanity: {props.characterInfo.currentSanity} / {props.characterInfo.startingSanity}</div>
					<div className='character-stat-text'>Spirit: {props.characterInfo.currentSpirit} / {props.characterInfo.startingSpirit}</div>
					<div className={`character-stat-text${props.characterInfo.levelUpPoints > 0 ? ' highlight-row' : ''}`}>
						<span>Strength: {props.characterInfo.strength + (levelUpPointAllocations.stats.strength || 0)}</span>
						{props.characterInfo.levelUpPoints > 0 &&
							<span>
								<span className={`general-button level-up-button${availableLevelUpPoints === 0 ? ' button-disabled' : ''}`} onClick={() => {
									updateLevelPointAlloc('stats', 'strength', 'add');
									updateLevelUpPoints(availableLevelUpPoints - 1);
								}}>+</span>
								<span className={`general-button level-up-button${!levelUpPointAllocations.stats.strength ? ' button-disabled' : ''}`} onClick={() => {
									updateLevelPointAlloc('stats', 'strength', 'subtract');
									updateLevelUpPoints(availableLevelUpPoints + 1);
								}}>-</span>
							</span>
						}
					</div>
					<div className={`character-stat-text${props.characterInfo.levelUpPoints > 0 ? ' highlight-row' : ''}`}>
						<span>Agility: {props.characterInfo.agility + (levelUpPointAllocations.stats.agility || 0)}</span>
						{props.characterInfo.levelUpPoints > 0 &&
							<span>
								<span className={`general-button level-up-button${availableLevelUpPoints === 0 ? ' button-disabled' : ''}`} onClick={() => {
									updateLevelPointAlloc('stats', 'agility', 'add');
									updateLevelUpPoints(availableLevelUpPoints - 1);
								}}>+</span>
								<span className={`general-button level-up-button${!levelUpPointAllocations.stats.agility ? ' button-disabled' : ''}`} onClick={() => {
									updateLevelPointAlloc('stats', 'agility', 'subtract');
									updateLevelUpPoints(availableLevelUpPoints + 1);
								}}>-</span>
							</span>
						}
					</div>
					<div className={`character-stat-text${props.characterInfo.levelUpPoints > 0 ? ' highlight-row' : ''}`}>
						<span>Mental Acuity: {props.characterInfo.mentalAcuity + (levelUpPointAllocations.stats.mentalAcuity || 0)}</span>
						{props.characterInfo.levelUpPoints > 0 &&
							<span>
								<span className={`general-button level-up-button${availableLevelUpPoints === 0 ? ' button-disabled' : ''}`} onClick={() => {
									updateLevelPointAlloc('stats', 'mentalAcuity', 'add');
									updateLevelUpPoints(availableLevelUpPoints - 1);
								}}>+</span>
								<span className={`general-button level-up-button${!levelUpPointAllocations.stats.mentalAcuity ? ' button-disabled' : ''}`} onClick={() => {
									updateLevelPointAlloc('stats', 'mentalAcuity', 'subtract');
									updateLevelUpPoints(availableLevelUpPoints + 1);
								}}>-</span>
							</span>
						}
					</div>
					<div className='character-stat-text'>Initiative: {props.characterInfo.initiative}</div>
					<div className='character-stat-text'>Defense: {props.characterInfo.defense}</div>
					<div className='character-stat-text'>Damage Reduction: {props.characterInfo.damageReduction}{equippedItems.armor ? ` (from ${itemsPossessed[equippedItems.armor].name})` : ''}</div>
				</div>

				<div className={`char-info-skills-container ${activeTab !== 'skills' ? 'hide' : ''}`}>
					{props.characterInfo.levelUpPoints > 0 &&
						<div className='level-up-header highlight-row'>
							<div className='character-stat-text'>Investigator has increased in expertise.</div>
							<div className='character-stat-text'>
								<span>Points to add: {availableLevelUpPoints}</span>
								<span className={`general-button${availableLevelUpPoints === props.characterInfo.levelUpPoints ? ' button-disabled' : ''}`}
								      onClick={() => {
									      props.assignLevelUpPoints(props.characterInfo.id, levelUpPointAllocations);
									      updatePointAllocations({stats: {}, skills: {}});
								      }}
								>Save</span>
							</div>
						</div>
					}
					{skillList}
				</div>
			</div>
		</div>
	);
}

function ObjectInfoPanel(props) {
	const {
		objectInfo,
		isDraggedObject,
		setObjectSelected,
		setObjectPanelDisplayOption,
		selectedObjPos,
		objHasBeenDropped,
		setHasObjBeenDropped,
		// dropItemToPC,  - to be used for buttons as alts for drag-and-drop if needed
		// dropItemToEquipped,
		// dropItemToInv,
		addObjectToMap,
		addStackedObjToOtherPc,
		addItemToPlayerInventory,
		isPickUpAction,
		isMapObj,
		notEnoughSpaceDialogProps,
		setShowDialogProps,
		creatureCoords,
		activePc,
		activePcInfo,
		setContainerOpenState} = {...props};
	const [origObjectList, updateOrigObjectList] = useState(objectInfo);
	const [containerId, updateContainerId] = useState(null);
	const [objectToShow, updateObjToShow] = useState(isMapObj ? null : objectInfo);
	const splitStack = (evt) => {
		evt.preventDefault();
		const splitValue = +evt.target[0].value;
		const remainingCount = objectInfo.amount ? objectInfo.amount - splitValue : objectInfo.currentRounds - splitValue;

		if (objHasBeenDropped) {
			addObjectToMap(splitValue, remainingCount);
		} else {
			addStackedObjToOtherPc(splitValue, remainingCount);
		}
		cancelObjPanel();
	};
	const openContainer = (container) => {
		if (!container.isOpen || (container.isDestructible && !container.isDestroyed)) {
			setContainerOpenState(container.id);
		}
		// container id needed when taking item from container, and id needs to be saved to state because
		// info panel is re-rendered on opening (to show contents)
		updateContainerId(container.id);
		updateOrigObjectList(container.containerContents);
	};
	// list can be items on the ground or items in a container
	const objectList = () => {
		const list = [];
		if (origObjectList.length === 0) {
			list.push(
				<div key={0}>
					<div className='object-row-with-buttons'>
						<div></div>
						<div>{objectInfo.type === 'container' ? 'Empty' : 'Nothing was found'}</div>
					</div>
				</div>
			)
		} else {
			origObjectList.forEach((obj, index) => {
				if (obj) {
					const isEnvObject = obj.isEnvObject;
					list.push(
						<div key={obj.id}>
							<div className='object-row-with-buttons'>
								<div className={`inv-object ${convertObjIdToClassId(obj.id)}`}></div>
								<div>
									<div className='font-fancy object-list-objname'>{obj.isIdentified ? obj.name : '???'}</div>
									<div>{obj.description}</div>
								</div>
								{isPickUpAction && !isEnvObject &&
									<div className='general-button' onClick={() => updateObjToShow(obj)}>Show</div>
								}
								{isPickUpAction && !isEnvObject &&
								<div className='general-button' onClick={() => {
									if (creatureCoords.find(creature => creature.coords.xPos === obj.coords.xPos && creature.coords.yPos === obj.coords.yPos)) {
										const guardedDialogProps = {
											dialogContent: "That item can't be picked up, as it's being guarded by something horrid!",
											closeButtonText: 'Ok',
											closeButtonCallback: null,
											disableCloseButton: false,
											actionButtonVisible: false,
											actionButtonText: '',
											actionButtonCallback: null,
											dialogClasses: ''
										}
										setShowDialogProps(true, guardedDialogProps);
									} else if (notEnoughSpaceInInventory(1, 0, activePcInfo)) {
										setShowDialogProps(true, notEnoughSpaceDialogProps);
									} else {
										addItemToPlayerInventory(obj, obj.id, activePc, isPickUpAction, false, containerId);
										const updatedList = origObjectList;
										updatedList[index] = undefined;
										updateOrigObjectList(updatedList);
										if (updatedList.every(obj => obj === undefined)) {
											cancelObjPanel();
										}
									}
								}}>Pick up</div>
								}
								{isPickUpAction && isEnvObject && (obj.type === 'container' || obj.type === 'mineable') &&
									<div className='general-button' onClick={() => {
										openContainer(obj);
									}}>{(obj.isOpen || obj.isDestroyed) ? 'Collect Contents' : obj.type === 'mineable' ? 'Mine' : 'Open'}</div>
								}

							</div>
						</div>
					)
				}
			});
		}
		return list;
	}
	const cancelObjPanel = () => {
		setObjectSelected(null, null);
		setObjectPanelDisplayOption(false);
		if (objHasBeenDropped) {
			setHasObjBeenDropped({objHasBeenDropped: false, evt: null});
		}
	}

	return (
		<div className={`object-info-panel ${!selectedObjPos ? 'ui-panel' : ''}`} style={{left: selectedObjPos.left, top: selectedObjPos.top}}>
			<div className='general-button' onClick={() => cancelObjPanel()}>X</div>
			{!objectToShow &&
			<div>
				<div className='object-list-container'>
					{objectList()}
				</div>
			</div>
			}
			{objectToShow &&
			<div className='object-panel-container'>
				<div className='object-panel-contents'>
					<div className={`inv-object ${convertObjIdToClassId(objectToShow.id)}-inv`}></div>
					<div className='object-text-container'>
						<div className='font-fancy'>{objectToShow.isIdentified ? objectToShow.name : '???'}</div>
						<div>{objectToShow.itemType ? objectToShow.itemType : (objectToShow.ranged ? 'Ranged' : 'Melee') + ' weapon'}</div>
						{objectToShow.rounds && <div>Capacity: {objectToShow.rounds} rounds</div>}
						{objectToShow.amount && <div>Amount: {objectToShow.amount}</div>}
						{objectToShow.currentRounds !== null && objectToShow.currentRounds >= 0 && <div>Rounds remaining: {objectToShow.currentRounds}</div>}
						{objectToShow.twoHanded && <div>Two-handed</div>}
						{objectToShow.damage && <div>Base damage: {objectToShow.damage}</div>}
						{objectToShow.time !== null && objectToShow.time !== undefined && objectToShow.time >= 0 && <div>Light remaining: {objectToShow.time} steps</div>}
						<div>{objectToShow.description}</div>
						{objectToShow.isIdentified && <div>{objectToShow.furtherInfo}</div>}
						{objectToShow.isIdentified && objectToShow.effect && <div>Effect: {objectToShow.effect}</div>}
						{objectToShow.isIdentified && objectToShow.sanityCost && <div>Cost to Sanity: -{objectToShow.sanityCost}</div>}
						{objectToShow.isIdentified && objectToShow.spirit && <div>Required Spirit: -{objectToShow.spirit}</div>}
						</div>
				</div>
				<div className='object-panel-buttons-container'>
					{isDraggedObject && objectToShow.stackable &&
						<form className='object-row-with-buttons trade-buttons' onSubmit={evt => splitStack(evt)}>
							<label htmlFor='object-split'>{objHasBeenDropped ? 'Drop' : 'Trade'} how many?</label>
							<input id='object-split' type='number' name='object-split' size='3' defaultValue='1' min='1' max={objectToShow.amount || objectToShow.currentRounds} />
							<div className='all-button general-button' onClick={evt => evt.target.previousSibling.value = objectToShow.amount || objectToShow.currentRounds}>All</div>
							<button className='general-button' type='submit'>{objHasBeenDropped ? 'Drop' : 'Trade'}</button>
						</form>
					}
					{isMapObj &&
						<span className='general-button' onClick={() => updateObjToShow(null)}>Back</span>
					}
					{/* MAY ADD THESE BUTTONS FOR MOVING ITEMS (INSTEAD OF DRAG AND DROP) IN LATER IF NEEDED */}

					{/*{!isMapObj && !isDraggedObject &&*/}
					{/*	<div className='object-panel-buttons'>*/}
					{/*		<span className='general-button' onClick={() => dropItemToEquipped(null)}>Equip Right</span>*/}
					{/*		<span className='general-button' onClick={() => dropItemToEquipped(null)}>Equip Left</span>*/}
					{/*		<span className='general-button' onClick={() => dropItemToInv(null)}>Unequip</span>*/}
					{/*		<span className='general-button' onClick={() => {*/}
					{/*			if (objectToShow.stackable) {*/}
					{/*				setObjectPanelDisplayOption(true, null, null);*/}
					{/*			} else {*/}
					{/*				// don't need to pass in dropped and source counts, as it's not a stackable object*/}
					{/*				addObjectToMap();*/}
					{/*			}*/}
					{/*		}}>Drop</span>*/}
					{/*		<span className='general-button' onClick={() => {*/}
					{/*			let recipientId = '';*/}

					{/*			dropItemToPC(null, recipientId);*/}
					{/*		}}>Trade</span>*/}
					{/*	</div>*/}
					{/*}*/}
					<span className='general-button' onClick={() => cancelObjPanel()}>Close</span>
				</div>
			</div>
			}
		</div>
	);
}

function CreatureInfoPanel(props) {
	return (
		<div className={`creature-info-container ui-panel ${props.creatureIsSelected ? '' : 'hide'}`}>
			<div className='general-button' onClick={() => props.updateUnitSelectionStatus(props.creatureInfo.id, 'creature')}>X</div>
			<div className='creature-info-columns'>
				<div className='creature-info-icon-column'>
					<div className={`creature-icon ${convertObjIdToClassId(props.creatureInfo.id)}`}></div>
				</div>
				<div className='creature-info-column'>
					<div>Name: {props.creatureInfo.name}</div>
					<div>Level: {props.creatureInfo.level}</div>
					<div>Health: {props.creatureInfo.currentHealth} / {props.creatureInfo.startingHealth}</div>
					<div>Spirit: {props.creatureInfo.currentSpirit} / {props.creatureInfo.startingSpirit}</div>
					<div>Strength: {props.creatureInfo.strength}</div>
					<div>Agility: {props.creatureInfo.agility}</div>
					<div>Mental Acuity: {props.creatureInfo.mentalAcuity}</div>
					<div>Initiative: {props.creatureInfo.initiative}</div>
					<div>Damage: {props.creatureInfo.damage}</div>
					<div>Defense: {props.creatureInfo.defense}</div>
					<div>Damage Reduction: {props.creatureInfo.damageReduction}</div>
					<div>Range: {props.creatureInfo.range}</div>
					<div>Speed: {props.creatureInfo.moveSpeed}</div>
					<div>Perception: {props.creatureInfo.perception}</div>
				</div>
			</div>
		</div>
	);
}

function ModeInfoPanel(props) {
	const ListOptions = () => {
		let list = [];
		for (const [id, player] of Object.entries(props.players)) {
			if (!player.isDeadOrInsane) {
				list.push(<option key={id} value={id}>{player.name}</option>);
			}
		}
		return list;
	};
	let dyingPcName = '';
	let dyingPcGender = '';
	for (const player of Object.values(props.players)) {
		if (player.currentHealth <= 0 && !player.isDeadOrInsane) {
			dyingPcName = player.name;
			dyingPcGender = player.gender === 'Male' ? 'him' : 'her';
		}
	}
	const enemiesNearbyTacticalDialog = "You can't disable Tactical Mode with creatures still about!";
	const enemiesNearbySearchDialog = "You can't enable Search Mode with creatures nearby.";
	const partyNotNearbyDialog = 'Your party must all be in sight of each other to enable Follow mode';
	const pcIsDyingDialog = `You can't enter Follow Mode while ${dyingPcName} is dying. Either resuscitate ${dyingPcGender} or End Turn enough times to let death take its course.`
	const dialogProps = {
		dialogContent: '',
		closeButtonText: 'Ok',
		closeButtonCallback: null,
		disableCloseButton: false,
		actionButtonVisible: false,
		actionButtonText: '',
		actionButtonCallback:  null,
		dialogClasses: ''
	};
	const activePlayerObject = props.players[props.activeCharacter];
	const charactersTurn = activePlayerObject && (props.inTacticalMode || !props.isPartyNearby) ? activePlayerObject.name :
		props.inTacticalMode && props.threatList.length > 0 ? 'Enemies moving' : 'Wait...';

	return (
		<div className={`mode-info-container ${props.showDialog ? 'no-click' : ''}`}>
			<div className='mode-buttons-container'>
				<div
					className='general-button'
					onClick={() => {
						if (props.inTacticalMode) {
							if (props.threatList.length > 0) {
								dialogProps.dialogContent = enemiesNearbyTacticalDialog;
								props.setShowDialogProps(true, dialogProps);
							} else if (!props.isPartyNearby) {
								dialogProps.dialogContent = partyNotNearbyDialog;
								props.setShowDialogProps(true, dialogProps);
							} else if (dyingPcName) {
								dialogProps.dialogContent = pcIsDyingDialog;
								props.setShowDialogProps(true, dialogProps);
							} else {
								props.toggleTacticalMode(false);
							}
						} else if (!props.isPartyNearby) {
							dialogProps.dialogContent = partyNotNearbyDialog;
							props.setShowDialogProps(true, dialogProps);
						} else {
							props.toggleTacticalMode(true);
						}
					}}>
					{props.inTacticalMode ? 'In Tactical Mode' : 'In Follow Mode'}
				</div>
				<div className={'general-button button-search-mode' + (props.inSearchMode ? ' button-selected' : '')}
				     onClick={() => {
					     if (!props.inSearchMode) {
						     if (props.threatList.length > 0) {
							     dialogProps.dialogContent = enemiesNearbySearchDialog;
							     props.setShowDialogProps(true, dialogProps);
						     } else {
							     props.toggleSearchMode();
						     }
					     } else {
						     props.toggleSearchMode();
					     }
				     }}>
				</div>
			</div>

			{!props.inTacticalMode && props.isPartyNearby &&
			<label>
				<div>Leader</div>
				<select name='leader' value={props.activeCharacter} onChange={evt => {
					props.updateActiveCharacter(() => props.updateFollowModePositions([]), evt.target.value);
				}}>
					{props.players && <ListOptions />}
				</select>
			</label>
			}

			{(props.inTacticalMode || !props.isPartyNearby) &&
			<div>
				<div>Turn: {charactersTurn}</div>
				<div className='general-button' onClick={() => {
					props.updateCurrentTurn();
				}}>End Turn</div>
			</div>
			}
		</div>
	);
}

function DialogWindow(props) {
	return (
		<div className={`dialog ui-panel ${props.classes}`}>
			<div className='general-button dialog-button-x' onClick={() => props.closeDialogCallback()}>X</div>
			<div className='dialog-message'>{props.dialogContent}</div>
			<div className='dialog-buttons'>
				{!props.disableCloseButton &&
				<button
					className='dialog-button'
			        onClick={() => {
				        props.closeDialogCallback();
						if (props.closeButtonCallback) {
							props.closeButtonCallback();
						}
					}}>
					{props.closeButtonText}
				</button> }
				<button
					className={`dialog-button ${props.actionButtonVisible ? '' : 'hide'}`}
					onClick={() => {
						props.closeDialogCallback();
						if (props.actionButtonCallback) {
							props.actionButtonCallback();
						}
					}}>
					{props.actionButtonText}
				</button>
			</div>
		</div>
	);
}

function ContextMenu(props) {
	const listActions = [];

	for (const actionType of Object.keys(props.actionsAvailable)) {
		listActions.push(
			<div
				key={`context-manu-${actionType}`}
				className={`general-button ${actionType}-action`}
				style={props.buttonStyle}
				onClick={() => props.handleContextMenuSelection(actionType)}
			></div>
		)
	}

	return (
		<div className='ui-panel context-manu-container' style={props.menuPosStyle}>
			{listActions}
		</div>
	)
}

function HelpScreen(props) {
	const [contentNum, updateContentNum] = useState(1);
	return (
		<div className={`help-screen ui-panel ${props.showHelpScreen ? '' : 'hide'}`}>
			<div className='general-button help-screen-close' onClick={() => props.toggleHelpScreen()}>X</div>
			<div id={`help-screen-content-${props.screenData.isShort ? 'mobile-landscape-' : props.screenData.isNarrow ? 'mobile-portrait-' : ''}${contentNum}`} className='help-screen-content'></div>
			<div className='help-screen-nav-container'>
				<div className={`general-button arrow-button-left${contentNum === 1 ? ' button-disabled' : ''}`} onClick={() => {
					if (contentNum > 1) {
						updateContentNum(contentNum - 1);
					}
				}}>&#x2B05;</div>
				<div className={`general-button arrow-button-right${contentNum === 4 ? ' button-disabled' : ''}`} onClick={() => {
					if (contentNum < 4) {
						updateContentNum(contentNum + 1);
					}
				}}>&#x2B05;</div>
			</div>
		</div>
	);
}

// function HelpPopUp(props) {
// 	return (
// 		<div className='help-popup ui-panel'>
//
// 		</div>
// 	);
// }

function GameOptions(props) {
	const gameOptions = {...props.gameOptions};

	return (
		<div className={`dialog ui-panel ${props.showGameOptions ? '' : 'hide'}`}>
			<div className='font-fancy'>Game Options</div>
			<div className='game-options-container'>
				<div className='game-options-row'>
					<label>Play sound effects: </label>
					<button
						className='general-button'
						onClick={() => {
							gameOptions.playFx = !gameOptions.playFx;
							props.updateGameOptions(gameOptions);
						}}>
						{props.gameOptions.playFx ? 'On' : 'Off'}
					</button>
				</div>
				<div className={`game-options-row ${props.screenData.isIOS ? 'hide': ''}`}>
					<label>Sound effects volume: </label>
					<input className='audio-volume' type='range' min='0' max='1' step='0.1' value={gameOptions.fxVolume} onInput={evt => {
						gameOptions.fxVolume = evt.target.value;
						props.updateGameOptions(gameOptions);
					}} />
				</div>
				<div className='game-options-row'>
					<label>Play music: </label>
					<button
						className='general-button'
						onClick={() => {
							gameOptions.playMusic = !gameOptions.playMusic;
							props.updateGameOptions(gameOptions);
						}}>
						{props.gameOptions.playMusic ? 'On' : 'Off'}
					</button>
				</div>
				<div className={`game-options-row ${props.screenData.isIOS ? 'hide': ''}`}>
					<label>Music volume: </label>
					<input className='audio-volume' type='range' min='0' max='1' step='0.1' value={gameOptions.musicVolume} onInput={evt => {
						props.adjustMusicComponentVolume(evt.target.value);
						gameOptions.musicVolume = evt.target.value;
						props.updateGameOptions(gameOptions);
					}} />
				</div>
				<Music
					idProp={`music-${props.gameOptions.songName}-theme`}
					sourceName={props.gameOptions.songName}
				/>
			</div>
			<button
				className='dialog-button'
				onClick={() => props.toggleOptionsPanel()}>
				Close
			</button>
		</div>
	);
}

export {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, ObjectInfoPanel, ModeInfoPanel, DialogWindow, ContextMenu, HelpScreen, GameOptions};
