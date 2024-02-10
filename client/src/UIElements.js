import React, {useState} from 'react';
import {convertObjIdToClassId, notEnoughSpaceInInventory, handleItemOverDropZone} from './Utils';
import {Music} from './Audio';

function CharacterControls(props) {
	const currentPCdata = props.playerCharacters[props.characterId];
	const equippedItems = props.equippedItems.loadout1;
	const invItems = props.invItems;
	const pcSkills = currentPCdata.skills;
	const actionableItems = {
		weapons: [],
		medicine: [],
		skills: []
	};
	let actionButtonCount = 0;
	const actionButtonMax = 6;

	const handleWeaponClick = (weapon, reloading = false) => {
		// const ammoId = currentPCdata.weapons[weapon.weaponId].gunType + 'Ammo0';
		if (reloading) {
			props.reloadGun(weapon.weaponId);
		} else {
			props.toggleActionButton(props.characterId, weapon.weaponId, weapon.weaponName, 'weapon');
		}
	};
	const hasExtraAmmo = props.checkForExtraAmmo(currentPCdata);
	const actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0) ? 'button-inactive' : '';

	// add all equipped weapons to actionableItems.weapons
	for (const itemId of Object.values(equippedItems)) {
		// need this check for two-handed weapons, since both hands list the same weaponId
		const existingWeaponIndex = actionableItems.weapons.findIndex(weapon => weapon.weaponId === itemId);
		if (currentPCdata.weapons[itemId] && existingWeaponIndex === -1) {
			const weaponInfo = currentPCdata.weapons[itemId];
			if (weaponInfo.ranged) {
				const weaponButtonIndex = actionableItems.weapons.findIndex(listItem => listItem.weaponName === weaponInfo.name);
				if (weaponInfo.gunType) {
					actionableItems.weapons.push({weaponId: itemId, gunType: weaponInfo.gunType, weaponName: weaponInfo.name, isGun: true, ammo: weaponInfo.currentRounds, fullyLoaded: weaponInfo.rounds});
				// check to make sure this stackable weapon isn't already in the controls and has some ammo
				} else if (weaponButtonIndex === -1 && weaponInfo.stackable && weaponInfo.currentRounds > 0) {
					actionableItems.weapons.push({weaponId: itemId, weaponName: weaponInfo.name, ammo: weaponInfo.currentRounds});
				// stackable weapon is already added, so we just need to update its ammo count (this is in case there are multiple stacks under different IDs)
				} else if (weaponButtonIndex >= 0 && weaponInfo.stackable) {
					actionableItems.weapons[weaponButtonIndex].ammo += weaponInfo.currentRounds;
				}
			} else {
				actionableItems.weapons.push({weaponId: itemId, weaponName: weaponInfo.name, ammo: null});
			}
		}
	}

	// add all inv medicine items to actionableItems.medicine
	for (const [itemId, itemInfo] of Object.entries(invItems)) {
		if (itemInfo.itemType === 'Medicine') {
			const matchingItem = actionableItems.medicine.findLast(item => item.name === itemInfo.name);
			let existingAmount = 1;
			if (matchingItem) {
				existingAmount = matchingItem.amount + 1;
			}
			actionableItems.medicine.push({itemId, name: itemInfo.name, amount: existingAmount});
		}
	}

	// add all action or create skills to actionableItems.skills
	for (const [skillId, skillInfo] of Object.entries(pcSkills)) {
		if (skillInfo.skillType === 'create' || skillInfo.skillType === 'active') {
			actionableItems.skills.push({
				skillId,
				name: skillInfo.name,
				skillType: skillInfo.skillType,
				mustBeOutOfDanger: skillInfo.mustBeOutOfDanger,
				hasTarget: skillInfo.hasTarget
			});
		}
	}

	const weaponButtons = (
		<div className='weapon-buttons-container'>
			{actionableItems.weapons.map((weapon, index) => {
				let actionButtonState = '';
				let button;
				if (weapon.isGun) {
					actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0 || weapon.ammo === 0) ? 'button-inactive' :
						(props.isActiveCharacter && props.actionButtonSelected && props.actionButtonSelected.characterId === props.characterId && props.actionButtonSelected.itemId === weapon.weaponId) ? 'button-selected': '';
					const reloadButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0 || props.actionButtonSelected || weapon.ammo === weapon.fullyLoaded || !hasExtraAmmo) ? 'button-inactive' :
						(props.isActiveCharacter && props.actionButtonSelected && props.actionButtonSelected.characterId === props.characterId && props.actionButtonSelected.itemId === weapon.weaponId) ? 'button-selected': '';
					button = (
						<div className='action-button-pair' key={weapon.weaponId}>
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
					actionButtonCount += 2;
				} else {
					actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0 || (weapon.ammo === 0 && !hasExtraAmmo)) ? 'button-inactive' :
						(props.isActiveCharacter && props.actionButtonSelected && props.actionButtonSelected.characterId === props.characterId && props.actionButtonSelected.itemId === weapon.weaponId) ? 'button-selected': '';
					button = (
						<div
							className={`action-button ${convertObjIdToClassId(weapon.weaponId)}-action ${actionButtonState} ${weapon.ammo === 0 ? 'gun-reload-icon' : ''}`}
							key={weapon.weaponId}
							onClick={() => {
								handleWeaponClick(weapon);
							}}
						>{weapon.ammo || ''}</div>
					);
					actionButtonCount++;
				}
				return button;
			})}
		</div>
	);

	const medicineButtons = (
		<div className='item-buttons-container'>
			{actionableItems.medicine.map((item, index) => {
				const itemCount = actionableItems.medicine.findLast(match => match.name === item.name).amount;
				let button = null;
				if (item.amount === itemCount) {
					const actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0) ? 'button-inactive' :
						(props.isActiveCharacter && props.actionButtonSelected && props.actionButtonSelected.characterId === props.characterId && props.actionButtonSelected.itemId === item.itemId) ? 'button-selected': '';
					button = (
						<div className={`action-button ${convertObjIdToClassId(item.itemId)}-action ${actionButtonState}`} key={item.itemId} onClick={() => {
							props.toggleActionButton(props.characterId, item.itemId, item.name, 'item');
						}}>{itemCount}</div>
					);
					actionButtonCount++;
				}
				return button;
			})}
		</div>
	);

	const skillButtons = (
		<div className='skill-buttons-container'>
			{actionableItems.skills.map((skill, index) => {
				let button = null;
				const actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0 || (skill.mustBeOutOfDanger && props.threatList.length > 0)) ? 'button-inactive' :
					(props.isActiveCharacter && props.actionButtonSelected && props.actionButtonSelected.characterId === props.characterId && props.actionButtonSelected.itemId === skill.skillId && skill.hasTarget) ? 'button-selected': '';
				let skillClass = `${convertObjIdToClassId(skill.skillId)}-action`;
				if (skill.skillType === 'create') {
					skillClass = 'create-' + skillClass;
				}
				button = (
					<div className={`action-button ${skillClass} ${actionButtonState}`} key={skill.skillId} onClick={() => {
						props.toggleActionButton(props.characterId, skill.skillId, skill.name, 'skill');
					}}></div>
				);
				actionButtonCount++;
				return button;
			})}
		</div>
	);

	const displayCharName = !props.screenData.isSmall || (props.screenData.isSmall && props.characterId === props.selectedControlTab);
	const healthLevel = (currentPCdata.currentHealth / currentPCdata.startingHealth) * 100;
	const sanityLevel = (currentPCdata.currentSanity / currentPCdata.startingSanity) * 100;
	const spiritLevel = (currentPCdata.currentSpirit / currentPCdata.startingSpirit) * 100;
	return (
		<div
			id={`${(props.screenData.isSmall && props.characterId === props.selectedControlTab) ? 'control-bar-tab-1' : ''}`}
			className='control-bar-tab-container'
			onDragOver={(evt) => handleItemOverDropZone(evt)}
			onDrop={(evt) => props.dropItemToPC(evt, props.characterId)}>

			<div className='control-bar-tab character-name font-fancy' onClick={() => props.setSelectedControlTab(props.characterId)}>
				<span className={`control-bar-tab-icon ${convertObjIdToClassId(props.characterId)}`}></span>
				{displayCharName ? props.characterName : ''}
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
				{actionButtonCount > actionButtonMax &&
					<div className='action-button action-button-scroll'>⬅</div>
				}
				{weaponButtons}
				{skillButtons}
				{medicineButtons}
				<div className='misc-action-buttons-container'>
					{(props.mapObjectsOnPcTiles.length > 0) &&
					<div className={`action-button pickup-action ${actionButtonState}`} onClick={(evt) => props.setMapObjectSelected(props.mapObjectsOnPcTiles, evt, true)}></div>
					}
					{((currentPCdata.equippedLight && (currentPCdata.equippedLight.includes('lantern') || currentPCdata.equippedLight.includes('torch'))) &&
					currentPCdata.lightTime < currentPCdata.items[currentPCdata.equippedLight].maxTime && currentPCdata.items.oil0) &&
					<div className={`action-button refill-action ${actionButtonState}`} onClick={props.refillLight}></div>
					}
				</div>
				{actionButtonCount > actionButtonMax &&
				<div className='action-button arrow-button-right action-button-scroll'>⬅</div>
				}
			</div>
		</div>
	);
}

function CharacterInfoPanel(props) {
	const skillList = Object.values(props.characterInfo.skills).map(item => <li key={item.name + Math.random()}>{item.name}</li>);
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
		<div className='character-info-container ui-panel'>
			<div className='char-info-header'>
				<h3 className='font-fancy'>{props.characterInfo.name}</h3>
				<div className='general-button' onClick={() => props.updateUnitSelectionStatus(props.characterInfo.id, 'player')}>X</div>
			</div>

			<div className='char-info-all-contents-container'>
				<div className='char-info-tabs-container'>
					<div className={`char-info-tab ${activeTab === 'inv' ? 'char-info-active-tab' : ''}`} onClick={() => updateActiveTab('inv')}>Inventory</div>
					<div className={`char-info-tab ${activeTab === 'stats' ? 'char-info-active-tab' : ''}`} onClick={() => updateActiveTab('stats')}>Attributes</div>
					<div className={`char-info-tab ${activeTab === 'skills' ? 'char-info-active-tab' : ''}`} onClick={() => updateActiveTab('skills')}>Skills</div>
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
					<div>{props.characterInfo.profession}</div>
					<div>Gender: {props.characterInfo.gender}</div>
					<div>Health: {props.characterInfo.currentHealth} / {props.characterInfo.startingHealth}</div>
					<div>Sanity: {props.characterInfo.currentSanity} / {props.characterInfo.startingSanity}</div>
					<div>Spirit: {props.characterInfo.currentSpirit} / {props.characterInfo.startingSpirit}</div>
					<div>Level: {props.characterInfo.level}</div>
					<div>XP: {props.characterInfo.xp}</div>
					<div>Strength: {props.characterInfo.strength}</div>
					<div>Agility: {props.characterInfo.agility}</div>
					<div>Mental Acuity: {props.characterInfo.mentalAcuity}</div>
					<div>Initiative: {props.characterInfo.initiative}</div>
					<div>Defense: {props.characterInfo.defense}</div>
					<div>Damage Reduction: {props.characterInfo.damageReduction}{equippedItems.armor ? ` (from ${itemsPossessed[equippedItems.armor].name})` : ''}</div>
				</div>

				<div className={`char-info-skills-container ${activeTab !== 'skills' ? 'hide' : ''}`}>
					<div>Skills:
						<ul>{skillList}</ul>
					</div>
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
		dialogProps,
		setShowDialogProps,
		creatureCoords,
		activePc} = {...props};
	const [origObjectList, updateOrigObjectList] = useState(objectInfo);
	const [objectToShow, updateObjToShow] = useState(isMapObj ? null : objectInfo);
	const splitStack = (evt) => {
		evt.preventDefault();
		const splitValue = +evt.target[0].value;
		const remainingCount = objectInfo.amount ? objectInfo.amount - splitValue : objectInfo.currentRounds - splitValue;

		if (objHasBeenDropped) {
			addObjectToMap(splitValue, remainingCount)
		} else {
			addStackedObjToOtherPc(splitValue, remainingCount);
		}
		cancelObjPanel();
	};
	const objectList = () => {
		const list = [];
		origObjectList.forEach((obj, index) => {
			if (obj) {
				list.push(
					<div key={obj.id}>
						<div className='object-row-with-buttons'>
							<div className={`inv-object ${convertObjIdToClassId(obj.id)}`}></div>
							<div>
								<div className='font-fancy object-list-objname'>{obj.name}</div>
								<div>{obj.description}</div>
							</div>
							{isPickUpAction &&
								<div className='general-button' onClick={() => updateObjToShow(obj)}>Show</div>
							}
							{isPickUpAction &&
							<div className='general-button' onClick={() => {
								if (dialogProps) {
									setShowDialogProps(true, dialogProps);
								} else if (creatureCoords.find(creature => creature.coords.xPos === obj.coords.xPos && creature.coords.yPos === obj.coords.yPos)) {
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
								} else {
									addItemToPlayerInventory(obj, obj.id, activePc, isPickUpAction);
									const updatedList = origObjectList;
									updatedList[index] = undefined;
									updateOrigObjectList(updatedList);
									if (updatedList.every(obj => obj === undefined)) {
										cancelObjPanel();
									}
								}
							}}>Pick up</div>
							}
						</div>
					</div>
				)
			}
		});
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
				<div className={`inv-object ${convertObjIdToClassId(objectToShow.id)}-inv`}></div>
				<div className='object-text-container'>
					<div className='font-fancy'>{objectToShow.name}</div>
					<div>{objectToShow.itemType ? objectToShow.itemType : (objectToShow.ranged ? 'Ranged' : 'Melee') + ' weapon'}</div>
					{objectToShow.rounds && <div>Capacity: {objectToShow.rounds} rounds</div>}
					{objectToShow.amount && <div>Amount: {objectToShow.amount}</div>}
					{objectToShow.currentRounds !== null && objectToShow.currentRounds >= 0 && <div>Rounds remaining: {objectToShow.currentRounds}</div>}
					{objectToShow.twoHanded && <div>Two-handed</div>}
					{objectToShow.damage && <div>Damage: {objectToShow.damage}</div>}
					{objectToShow.time && <div>Light remaining: {objectToShow.time} steps</div>}
					<div>{objectToShow.description}</div>
				</div>
				<div className='object-panel-buttons-container'>
					{isDraggedObject && objectToShow.stackable &&
						<form className='object-row-with-buttons' onSubmit={(evt) => splitStack(evt)}>
							<label htmlFor='object-split'>{objHasBeenDropped ? 'Drop' : 'Trade'} how many?</label>
							<input type='number' id='object-split' name='object-split' size='3' defaultValue='1' min='1' max={objectToShow.amount || objectToShow.currentRounds} />
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
					<span className='general-button' onClick={() => cancelObjPanel()}>Cancel</span>
				</div>
			</div>
			}
		</div>
	);
}

function SkillInfoPanel(props) {
	const {
		skillInfo,
		setSkillSelected,
		setSkillPanelDisplayOption,
		panelPos} = {...props};
	const [skillToShow] = useState(skillInfo);
	const cancelSkillPanel = () => {
		setSkillSelected(null, null);
		setSkillPanelDisplayOption(false);
	}
	return (
		<div className='skill-info-panel ui-panel' style={{top: panelPos.top, left: panelPos.left}}>
			<div className='general-button' onClick={() => cancelSkillPanel()}>X</div>
			{skillToShow &&
				<div className='skill-panel-container'>
					<div className='skill-text-container'>
						<div className='font-fancy'>{skillToShow.name}</div>
						<div>{skillToShow.description}</div>
						{/*Need to show cost/bonus*/}
					</div>
					<div className='skill-panel-buttons-container'>
						<span className='general-button' onClick={() => cancelSkillPanel()}>Cancel</span>
					</div>
				</div>
			}
		</div>
	)
}

function CreatureInfoPanel(props) {
	return (
		<div className={`creature-info-container ui-panel ${props.creatureIsSelected ? '' : 'hide'}`}>
			<div className='general-button' onClick={() => props.updateUnitSelectionStatus(props.creatureInfo.id, 'creature')}>X</div>
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
	);
}

function ModeInfoPanel(props) {
	const ListOptions = () => {
		let list = [];
		for (const [id, player] of Object.entries(props.players)) {
			list.push(<option key={id} value={id}>{player.name}</option>);
		}
		return list;
	};
	const enemiesNearbyDialog = {
		dialogContent: "You can't disable Tactical Mode with creatures still about!",
		closeButtonText: 'Ok',
		closeButtonCallback: null,
		disableCloseButton: false,
		actionButtonVisible: false,
		actionButtonText: '',
		actionButtonCallback:  null,
		dialogClasses: ''
	};
	const partyNotNearbyDialog = {
		dialogContent: "Your party must all be in sight of each other to enable Follow mode",
		closeButtonText: 'Ok',
		closeButtonCallback: null,
		disableCloseButton: false,
		actionButtonVisible: false,
		actionButtonText: '',
		actionButtonCallback:  null,
		dialogClasses: ''
	}
	const activePlayerObject = props.players[props.activeCharacter];
	const charactersTurn = activePlayerObject && (props.inTacticalMode || !props.isPartyNearby) ? activePlayerObject.name :
		props.inTacticalMode && props.threatList.length > 0 ? 'Enemies moving...' : 'Wait...';

	return (
		<div className='mode-info-container'>
			<div
				className={'general-button' + (props.inTacticalMode ? ' button-tactical-mode-on' : '')}
				onClick={() => {
					if (props.inTacticalMode) {
						if (props.threatList.length > 0) {
							props.setShowDialogProps(true, enemiesNearbyDialog);
						} else if (!props.isPartyNearby) {
							props.setShowDialogProps(true, partyNotNearbyDialog);
						} else {
							props.toggleTacticalMode(false);
						}
					} else if (!props.isPartyNearby) {
						props.setShowDialogProps(true, partyNotNearbyDialog);
					} else {
						props.toggleTacticalMode(true);
					}
				}}>
				{props.inTacticalMode ? 'In Tactical Mode' : 'In Follow Mode'}
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
					props.endTurnCallback();
				}}>End Turn</div>
			</div>
			}
		</div>
	);
}

function DialogWindow(props) {
	return (
		<div className={`dialog ui-panel ${props.classes}`}>
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

export {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, ObjectInfoPanel, SkillInfoPanel, ModeInfoPanel, DialogWindow, ContextMenu, HelpScreen, GameOptions};
