import React, {useRef} from 'react';
import {convertObjIdToClassId} from './Utils';

let actionRefs = {};
let draggedItem = null;
let draggedItemSourceLoc = null;

function CharacterControls(props) {
	actionRefs[props.characterId] = useRef([]);
	let actionButtonState = '';
	const currentPCdata = props.playerCharacters[props.characterId];
	const equippedItems = props.equippedItems.loadout1;
	const invItems = props.invItems;
	const actionableItems = {
		weapons: [],
		medicine: []
	};

	const handleItemOverDropZone = (e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	}
	const dropItemToPC = (e) => {
		e.preventDefault();
		draggedItem.data.itemType ? currentPCdata.items[draggedItem.id] = draggedItem.data : currentPCdata.weapons[draggedItem.id] = draggedItem.data;
		props.updateCharacters('player', currentPCdata, props.characterId, false, false, () => {
			const sourcePCdata = {...props.playerCharacters[draggedItem.sourcePC]};
			const sourceBoxIndex = draggedItemSourceLoc.match(/\d+/)[0];
			let tempAllItemsList = [...props.entireInventory[props.characterId]];
			// remove dragged item
			tempAllItemsList.splice(sourceBoxIndex, 1, null);

			draggedItem.data.itemType ? delete sourcePCdata.items[draggedItem.id] : delete sourcePCdata.weapons[draggedItem.id];
			if (sourcePCdata.equippedItems.loadout1.left === draggedItem.id) {
				sourcePCdata.equippedItems.loadout1.left = '';
			} else if (sourcePCdata.equippedItems.loadout1.right === draggedItem.id) {
				sourcePCdata.equippedItems.loadout1.right = '';
			} else if (sourcePCdata.equippedLight === draggedItem.id) {
				sourcePCdata.equippedLight = null;
				sourcePCdata.lightRange = 0;
			}

			props.updateCharacters('player', sourcePCdata, draggedItem.sourcePC, false, false, () => {
				props.updateInventory(props.characterId, tempAllItemsList);
			});
		});
	}

	for (const itemId of Object.values(equippedItems)) {
		const existingWeaponIndex = actionableItems.weapons.findIndex(weapon => weapon.weaponId === itemId);
		if (currentPCdata.weapons[itemId] && existingWeaponIndex === -1) {
			const weaponInfo = currentPCdata.weapons[itemId];
			if (weaponInfo.ranged) {
				if (weaponInfo.gunType) {
					actionableItems.weapons.push({weaponId: itemId, weaponName: weaponInfo.name, isGun: true, ammo: props.ammo[weaponInfo.gunType]});
					// check to make sure this weapon isn't already in the controls and has some ammo
				} else if (!actionableItems.weapons.find(listItem => listItem.weaponName === weaponInfo.name) && props.ammo.stackable[weaponInfo.name] > 0) {
					actionableItems.weapons.push({weaponId: itemId, weaponName: weaponInfo.name, ammo: props.ammo.stackable[weaponInfo.name]});
				}
			} else {
				actionableItems.weapons.push({weaponId: itemId, weaponName: weaponInfo.name, ammo: -1});
			}
		}
	}

	for (const [itemId, itemInfo] of Object.entries(invItems)) {
		if (itemInfo.itemType === 'Medicine') {
			const itemIndex = actionableItems.medicine.findIndex(item => item.name === itemInfo.name);
			if (itemIndex >= 0) {
				actionableItems.medicine[itemIndex].amount += 1;
			} else {
				actionableItems.medicine.push({[itemId]: {name: itemInfo.name, amount: 1}});
			}
		}
	}

	actionRefs[props.characterId].current = actionableItems.weapons.concat(actionableItems.medicine).map((item, index) => {
		return actionRefs[props.characterId].current[index] || React.createRef();
	});
	const weaponButtons = (
		<div className='weapon-buttons-container'>
			{actionableItems.weapons.map((weapon, index) => {
				actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0 || (weapon.ammo === 0)) ? 'button-inactive' :
					(props.weaponButtonSelected.characterId === props.characterId && props.weaponButtonSelected.weaponId === weapon.weaponId) ? 'button-selected': '';
				return (
					<div ref={actionRefs[props.characterId].current[index]} className={`weapon-button ${convertObjIdToClassId(weapon.weaponId)}-act ${actionButtonState}`} key={weapon.weaponId} onClick={() => {
						props.toggleWeaponButton(props.characterId, weapon.weaponId, weapon.weaponName);
					}}>{weapon.ammo >= 0 ? weapon.ammo : ''}</div>
				);
			})}
		</div>
	);
	const medicineButtons = (
		<div className='item-buttons-container'>
			{actionableItems.medicine.map((item, index) => {
				const itemId = Object.keys(item)[0];
				actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0) ? 'button-inactive' :
					(props.weaponButtonSelected.characterId === props.characterId && props.weaponButtonSelected.weaponId === item.name) ? 'button-selected': '';
				return (
					<div ref={actionRefs[props.characterId].current[index]} className={`weapon-button ${convertObjIdToClassId(itemId)}-act ${actionButtonState}`} key={itemId} onClick={() => {
						props.toggleWeaponButton(props.characterId, itemId, item.name);
					}}>{item.amount}</div>
				);
			})}
		</div>
	);

	return (
		<div
			className='character-control-container'
			onDragOver={(e) => {handleItemOverDropZone(e)}}
			onDrop={(e) => {dropItemToPC(e)}}
		>
			<div>
				<div className='character-name font-fancy'>{props.characterName}</div>
				<div>Moves remaining: {props.isActiveCharacter ? props.movesRemaining : ''}</div>
				<div>Actions remaining: {props.isActiveCharacter ? props.actionsRemaining : ''}</div>
			</div>
			{weaponButtons}
			{medicineButtons}
		</div>
	);
}

function CharacterInfoPanel(props) {
	const skillList = Object.values(props.characterInfo.skills).map(item => <li key={item + Math.random()}>{item}</li>);
	const equippedLight = props.characterInfo.items[props.characterInfo.equippedLight];
	const equippedItems = props.characterInfo.equippedItems;
	const updateData = {...props.characterInfo};
	const dragItem = (e) => {
		const itemId = e.target.id.includes('-2handed') ? e.target.id.slice(0, e.target.id.indexOf('-2handed')) : e.target.id;
		draggedItem = {id: itemId, data: updateData.items[itemId] || updateData.weapons[itemId], sourcePC: updateData.id};
		draggedItemSourceLoc = e.target.parentElement.id;
		// e.dataTransfer.clearData();
		// e.dataTransfer.setData('image/png:base64', itemId);
	}
	const handleItemOverDropZone = (e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	}
	const dropItemToEquipped = (e) => {
		e.preventDefault();
		if (draggedItem.data.itemType && draggedItem.data.itemType !== 'Light') {
			return;
		}
		const targetClasses = e.target.className;
		const parentClasses = e.target.parentElement.className;
		// don't know which hand dragged to and don't know if that hand already has an item equipped (if it doesn't, target class would include the "box" class)
		const hand = targetClasses.includes('char-info-paper-doll-box') ? (targetClasses.includes('right') ? 'right' : 'left') : (parentClasses.includes('right') ? 'right' : 'left');
		const oppositeHand = hand === 'right' ? 'left' : 'right';
		let tempAllItemsList = [...props.entireInventory[props.characterInfo.id]];
		const sourceBoxIndex = +draggedItemSourceLoc.match(/\d+/)[0];

		// if dragged item is a light
		if (draggedItem.data.itemType === 'Light') {
			updateData.equippedLight = draggedItem.id;
			updateData.lightRange = draggedItem.data.range;
		// or if an equipped light is being unequipped (and not by a light)
		} else if (updateData.equippedItems.loadout1[hand] === updateData.equippedLight ||
			(draggedItem.data.twoHanded && updateData.equippedItems.loadout1[oppositeHand] === updateData.equippedLight)) {
			updateData.equippedLight = null;
			updateData.lightRange = 0;
		}
		// if dragged item is two-handed
		if (draggedItem.data.twoHanded) {
			updateData.equippedItems.loadout1[oppositeHand] = draggedItem.id;
		// or if we're replacing a two-handed item with a one-handed item
		} else if (e.target.id.includes('2handed')) {
			updateData.equippedItems.loadout1[oppositeHand] = '';
		}
		updateData.equippedItems.loadout1[hand] = draggedItem.id;
		tempAllItemsList.splice(sourceBoxIndex, 1, null);
		props.updateInventory(props.characterInfo.id, tempAllItemsList, () => {
			props.updateCharacters('player', updateData, props.characterInfo.id, false, false);
		});
	};
	const dropItemToInv = (e) => {
		e.preventDefault();
		let draggingEquippedItem = false;
		if (equippedItems.loadout1.left === draggedItem.id) {
			updateData.equippedItems.loadout1.left = '';
			draggingEquippedItem = true;
		}
		if (equippedItems.loadout1.right === draggedItem.id) {
			updateData.equippedItems.loadout1.right = '';
			draggingEquippedItem = true;
		}
		if (draggedItem.data.itemType && draggedItem.data.itemType === 'Light' && updateData.equippedLight === draggedItem.id) {
			updateData.equippedLight = null;
			updateData.lightRange = 0;
			draggingEquippedItem = true;
		}
		if (draggingEquippedItem) {
			props.updateCharacters('player', updateData, props.characterInfo.id, false, false);
		} else {
			let tempAllItemsList = [...props.entireInventory[props.characterInfo.id]];
			const targetIsBox = e.target.id.includes('invBox');
			const targetId = +e.target.id.match(/\d+/)[0];
			const parentId = !targetIsBox ? +e.target.parentElement.id.match(/\d+/)[0] : null;
			const destBoxIndex = targetIsBox ? targetId : parentId;
			const destBoxContents = tempAllItemsList[destBoxIndex];
			const sourceBoxIndex = +draggedItemSourceLoc.match(/\d+/)[0];

			// replace contents of destination spot with dragged item
			tempAllItemsList.splice(destBoxIndex, 1, draggedItem.id);
			// replace contents of source spot with replaced destination item
			tempAllItemsList.splice(sourceBoxIndex, 1, destBoxContents);
			props.updateInventory(props.characterInfo.id, tempAllItemsList);
		}
	}
	const itemsIntoElements = (
		<div className='char-info-inv-items'>
			{props.entireInventory[props.characterInfo.id].map((itemId, index) => {
				return (
					<div
						id={'invBox' + index}
						key={'invBox' + index}
						className='char-info-inv-item-box'
						onDragOver={(e) => {handleItemOverDropZone(e)}}
						onDrop={(e) => {dropItemToInv(e)}}
					>
						{itemId &&
							<div
								id={itemId}
								className={`${convertObjIdToClassId(itemId)}-inv`}
								draggable={true}
								onDragStart={(e) => {dragItem(e, itemId)}}
							></div>
						}
					</div>
				);
			})}
		</div>
	);

	return (
		<div className={`character-info-container ui-panel ${props.characterIsSelected ? '' : 'hide'}`}>
			<div className='char-info-header'>
				<div>
					<div>Name: {props.characterInfo.name}</div>
					<div>Profession: {props.characterInfo.profession}</div>
				</div>
				<div>
					<div>Health: {props.characterInfo.currentHP} / {props.characterInfo.startingHP}</div>
					<div>Sanity: {props.characterInfo.currentSanity} / {props.characterInfo.startingSanity}</div>
				</div>
				<div className='general-button' onClick={() => props.updateUnitSelectionStatus(props.characterInfo.id, 'player')}>X</div>
			</div>

			<div className='char-info-inv-container'>
				<div className='char-info-doll-container'>
					<div className='char-info-paper-doll'></div>
					<div className='char-info-doll-boxes'>
						<div
							className='char-info-paper-doll-body char-info-paper-doll-box'
							onDragOver={(e) => {handleItemOverDropZone(e)}}
							onDrop={(e) => {dropItemToEquipped(e)}}
						>{equippedItems.armor ? '' : 'Body'}</div>

						<div
							className='char-info-paper-doll-right-arm char-info-paper-doll-box'
							onDragOver={(e) => {handleItemOverDropZone(e)}}
							onDrop={(e) => {dropItemToEquipped(e)}}
						>
							<div
								id={equippedItems.loadout1.right === equippedItems.loadout1.left ? equippedItems.loadout1.right + '-2handed' : equippedItems.loadout1.right}
								className={`${convertObjIdToClassId(equippedItems.loadout1.right)}-inv`}
								draggable={true}
								onDragStart={(e) => {dragItem(e, equippedItems.loadout1.right)}}
							>{equippedItems.loadout1.right ? '' : 'Right Hand'}</div>
						</div>

						<div
							className='char-info-paper-doll-left-arm char-info-paper-doll-box'
							onDragOver={(e) => {handleItemOverDropZone(e)}}
							onDrop={(e) => {dropItemToEquipped(e)}}
						>
							<div
								id={equippedItems.loadout1.left === equippedItems.loadout1.right ? equippedItems.loadout1.left + '-2handed' : equippedItems.loadout1.left}
								className={`${convertObjIdToClassId(equippedItems.loadout1.left)}-inv`}
								draggable={true}
								onDragStart={(e) => {dragItem(e, equippedItems.loadout1.left)}}
							>{equippedItems.loadout1.left ? '' : 'Left Hand'}</div>
						</div>
					</div>
					<div className='char-info-equip-toggle-button general-button' onClick={() => props.switchEquipment(props.characterInfo.id)}>Switch equipment</div>
				</div>

				<div className='char-info-stats-container'>
					<div>Level: {props.characterInfo.level}</div>
					<div>XP: {props.characterInfo.xp}</div>
					<div>Strength: {props.characterInfo.strength}</div>
					<div>Agility: {props.characterInfo.agility}</div>
					<div>Mental Acuity: {props.characterInfo.mentalAcuity}</div>
					<div>Initiative: {props.characterInfo.initiative}</div>
					<div>Defense: {props.characterInfo.defense}{props.characterInfo.items.armor ? ` from ${props.characterInfo.items.armor}` : ''}</div>
					<div>Skills:
						<ul>{skillList}</ul>
					</div>
				</div>
			</div>

			<div>
				<div>Equipped Light: {props.characterInfo.equippedLight ? `${equippedLight.name} (Time left: ${equippedLight.time})`: 'none'}</div>
				<div>
					Ammunition: {props.ammoList}
				</div>
			</div>

			{itemsIntoElements}
		</div>
	);
}

function CreatureInfoPanel(props) {
	return (
		<div className={`creature-info-container ui-panel ${props.creatureIsSelected ? '' : 'hide'}`}>
			<div className='general-button' onClick={() => props.updateUnitSelectionStatus(props.creatureInfo.id, 'creature')}>X</div>
			<div>Name: {props.creatureInfo.name}</div>
			<div>Level: {props.creatureInfo.level}</div>
			<div>Health: {props.creatureInfo.currentHP} / {props.creatureInfo.startingHP}</div>
			<div>Strength: {props.creatureInfo.strength}</div>
			<div>Agility: {props.creatureInfo.agility}</div>
			<div>Mental Acuity: {props.creatureInfo.mentalAcuity}</div>
			<div>Initiative: {props.creatureInfo.initiative}</div>
			<div>Defense: {props.creatureInfo.defense}</div>
			<div>Damage: {props.creatureInfo.damage}</div>
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
	const turnButtonState = props.inTacticalMode || !props.isPartyNearby ? '' : ' button-inactive';
	const activePlayerObject = props.players[props.activeCharacter];
	const charactersTurn = activePlayerObject && (props.inTacticalMode || !props.isPartyNearby) ? activePlayerObject.name :
		props.inTacticalMode && props.threatList.length > 0 ? 'Enemies moving...' : 'Something creeps deep in the darkness...';

	return (
		<div>
			<div
				className={`general-button ${props.inTacticalMode || !props.isPartyNearby ? 'button-tactical-mode-on' : ''}`}
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
				{props.inTacticalMode || !props.isPartyNearby ? 'Tactical Mode' : 'Follow Mode'}
			</div>
			{!props.inTacticalMode && props.isPartyNearby &&
				<label>
					<span>Leader: </span>
					<select name='leader' value={props.activeCharacter} onChange={e => {
						props.updateActiveCharacter(null, e.target.value);
					}}>
						{props.players && <ListOptions />}
					</select>
				</label>
			}
			{(props.inTacticalMode || !props.isPartyNearby) &&
				<div>
					<div>Turn: {charactersTurn}</div>
					<div className={'general-button' + turnButtonState} onClick={() => {
						let weaponName = '';
						const activeButton = actionRefs[props.activeCharacter].current.find(weapon => {
							weaponName = weapon.current.dataset['weapon'];
							return weapon.current.classList.contains('button-selected');
						});
						if (activeButton) {
							props.toggleWeaponButton(props.activeCharacter, weaponName, props.endTurnCallback);
						} else {
							props.endTurnCallback();
						}
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

function HelpPopUp(props) {
	return (
		<div className='help-popup ui-panel'>

		</div>
	);
}

export {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, ModeInfoPanel, DialogWindow};
