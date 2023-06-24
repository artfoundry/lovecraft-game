import React from 'react';
import {convertObjIdToClassId, notEnoughSpaceInInventory} from './Utils';

let draggedItem = null;
let draggedItemSourceLoc = null;

function CharacterControls(props) {
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
		const allPCdata = {...props.playerCharacters};
		const sourcePCdata = {...allPCdata[draggedItem.sourcePC]};
		const currentPCdata = {...allPCdata[props.characterId]};
		let allPlayersInv = {...props.entireInventory};
		let dialogProps = null;

		if (Math.abs(currentPCdata.coords.xPos - sourcePCdata.coords.xPos) > 1 || Math.abs(currentPCdata.coords.yPos - sourcePCdata.coords.yPos) > 1) {
			dialogProps = {
				dialogContent: 'That character is too far away. To trade, characters need to be next to each other.',
				closeButtonText: 'Ok',
				closeButtonCallback: null,
				disableCloseButton: false,
				actionButtonVisible: false,
				actionButtonText: '',
				actionButtonCallback: null,
				dialogClasses: ''
			};
		} else if (notEnoughSpaceInInventory(1, 0, currentPCdata)) {
			dialogProps = {
				dialogContent: "That character's inventory is full. Free up some space first.",
				closeButtonText: 'Ok',
				closeButtonCallback: null,
				disableCloseButton: false,
				actionButtonVisible: false,
				actionButtonText: '',
				actionButtonCallback: null,
				dialogClasses: ''
			};
		} else {
			const sourceBoxIndex = draggedItemSourceLoc.match(/\d+/);
			const firstOpenInvSlot = allPlayersInv[props.characterId].indexOf(null);

			// add dragged item to current pc inv
			allPlayersInv[props.characterId].splice(firstOpenInvSlot, 1, draggedItem.id);
			draggedItem.data.itemType ? currentPCdata.items[draggedItem.id] = draggedItem.data : currentPCdata.weapons[draggedItem.id] = draggedItem.data;

			// remove dragged item from source pc inv
			// if no source box index, then it was dragged from being equipped
			if (sourceBoxIndex) {
				allPlayersInv[draggedItem.sourcePC].splice(+sourceBoxIndex[0], 1, null);
			}
			draggedItem.data.itemType ? delete sourcePCdata.items[draggedItem.id] : delete sourcePCdata.weapons[draggedItem.id];
			if (sourcePCdata.equippedItems.loadout1.left === draggedItem.id) {
				sourcePCdata.equippedItems.loadout1.left = '';
			}
			// this is not an else if because a two handed weapon would take up both left and right
			if (sourcePCdata.equippedItems.loadout1.right === draggedItem.id) {
				sourcePCdata.equippedItems.loadout1.right = '';
			}
			if (sourcePCdata.equippedLight === draggedItem.id) {
				sourcePCdata.equippedLight = null;
				sourcePCdata.lightRange = 0;
			}

			allPCdata[props.characterId] = currentPCdata;
			allPCdata[draggedItem.sourcePC] = sourcePCdata;
			props.updateCharacters('player', allPCdata, null, false, false, () => {
				props.updateInventory(props.characterId, allPlayersInv[props.characterId], () => {
					props.updateInventory(draggedItem.sourcePC, allPlayersInv[draggedItem.sourcePC]);
				});
			});
		}

		if (dialogProps) {
			props.setShowDialogProps(true, dialogProps);
		}
	}

	for (const itemId of Object.values(equippedItems)) {
		// need this check for two-handed weapons, since both hands list the same weaponId
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
				actionableItems.weapons.push({weaponId: itemId, weaponName: weaponInfo.name, ammo: null});
			}
		}
	}

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

	const weaponButtons = (
		<div className='weapon-buttons-container'>
			{actionableItems.weapons.map((weapon, index) => {
				actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0 || (weapon.ammo === 0)) ? 'button-inactive' :
					(props.isActiveCharacter && props.itemButtonSelected.characterId === props.characterId && props.itemButtonSelected.itemId === weapon.weaponId) ? 'button-selected': '';
				return (
					<div className={`weapon-button ${convertObjIdToClassId(weapon.weaponId)}-act ${actionButtonState}`} key={weapon.weaponId} onClick={() => {
						props.toggleActionButton(props.characterId, weapon.weaponId, weapon.weaponName, 'weapon');
					}}>{weapon.ammo || ''}</div>
				);
			})}
		</div>
	);
	const medicineButtons = (
		<div className='item-buttons-container'>
			{actionableItems.medicine.map((item, index) => {
				const itemCount = actionableItems.medicine.findLast(match => match.name === item.name).amount;
				let button = null;
				if (item.amount === itemCount) {
					actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0) ? 'button-inactive' :
						(props.isActiveCharacter && props.itemButtonSelected.characterId === props.characterId && props.itemButtonSelected.itemId === item.itemId) ? 'button-selected': '';
					button = (
						<div className={`weapon-button ${convertObjIdToClassId(item.itemId)}-act ${actionButtonState}`} key={item.itemId} onClick={() => {
							props.toggleActionButton(props.characterId, item.itemId, item.name, 'item');
						}}>{itemCount}</div>
					);
				}
				return button;
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
	const equippedIsTwoHanded = equippedItems.loadout1.right && equippedItems.loadout1.right === equippedItems.loadout1.left;
	const updateData = {...props.characterInfo};
	const notEnoughSpaceDialogProps = {
		dialogContent: `There is not enough inventory space to do that.`,
		closeButtonText: 'Ok',
		closeButtonCallback: null,
		disableCloseButton: false,
		actionButtonVisible: false,
		actionButtonText: '',
		actionButtonCallback: null,
		dialogClasses: ''
	}
	const dragItem = (e) => {
		const itemId = e.target.id.includes('-2handed') ? e.target.id.slice(0, e.target.id.indexOf('-2handed')) : e.target.id;
		draggedItem = {id: itemId, data: updateData.items[itemId] || updateData.weapons[itemId], sourcePC: updateData.id};
		draggedItemSourceLoc = e.target.parentElement.id;
	}
	const handleItemOverDropZone = (e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	}
	const dropItemToEquipped = (e) => {
		e.preventDefault();
		const targetClasses = e.target.className;
		const parentClasses = e.target.parentElement.className;
		// don't know which hand dragged to and don't know if that hand already has an item equipped (if it doesn't, target class would include the "box" class)
		const destination = targetClasses.includes('-arm') ? 'hand-swap' : parentClasses.includes('-arm') ? 'hand' : 'body';

		// if item is dragged to a hand and is a non-light item (not including weapons) or item is dragged to body and isn't armor, exit out
		if ((destination.includes('hand') && (draggedItem.data.itemType && draggedItem.data.itemType !== 'Light')) ||
			(destination === 'body' && (!draggedItem.data.itemType || draggedItem.data.itemType !== 'Armor')))
		{
			return;
		}

		let hand = '';
		let oppositeHand = '';
		let tempAllItemsList = [...props.entireInventory[props.characterInfo.id]];
		const sourceBoxIndex = draggedItemSourceLoc.match(/\d+/);
		const loadout1 = equippedItems.loadout1;

		if (destination === 'hand-swap') {
			hand = targetClasses.includes('right') ? 'right' : 'left';
		} else if (destination === 'hand') {
			hand = parentClasses.includes('right') ? 'right' : 'left';
		}
		if (hand) {
			oppositeHand = hand === 'right' ? 'left' : 'right';
		}

		// if dragged item is a light
		if (draggedItem.data.itemType === 'Light') {
			updateData.equippedLight = draggedItem.id;
			updateData.lightRange = draggedItem.data.range;
		// or if an equipped light is being unequipped (and not by a light)
		} else if (hand && sourceBoxIndex && (loadout1[hand] === updateData.equippedLight ||
			(draggedItem.data.twoHanded && loadout1[oppositeHand] === updateData.equippedLight))) {
			updateData.equippedLight = null;
			updateData.lightRange = 0;
		}
		// if dragged item is two-handed
		if (hand && draggedItem.data.twoHanded) {
			if (loadout1.right && loadout1.left && loadout1.right !== loadout1.left && notEnoughSpaceInInventory(2, 1, props.characterInfo)) {
				const dialogProps = {
					dialogContent: `The ${draggedItem.data.name} is two-handed, and there is not enough space in the inventory for both currently equipped items.`,
					closeButtonText: 'Ok',
					closeButtonCallback: null,
					disableCloseButton: false,
					actionButtonVisible: false,
					actionButtonText: '',
					actionButtonCallback: null,
					dialogClasses: ''
				}
				props.setShowDialogProps(true, dialogProps);
				return;
			}
			updateData.equippedItems.loadout1[hand] = draggedItem.id;
			updateData.equippedItems.loadout1[oppositeHand] = draggedItem.id;
		// or if we're replacing a two-handed item with a one-handed item
		} else if (hand && equippedIsTwoHanded) {
			updateData.equippedItems.loadout1[hand] = draggedItem.id;
			updateData.equippedItems.loadout1[oppositeHand] = '';
		// or we're just equipping a one-handed item
		} else if (hand) {
			// if item is dragged from one hand to another, sourceBoxIndex is null
			if (!sourceBoxIndex) {
				updateData.equippedItems.loadout1[oppositeHand] = updateData.equippedItems.loadout1[hand];
			}
			updateData.equippedItems.loadout1[hand] = draggedItem.id;
		// or we're equipping a body item
		} else if (destination === 'body') {
			updateData.equippedItems.armor = draggedItem.id;
			updateData.defense = props.characterInfo.calculateDefense();
			updateData.damageReduction = draggedItem.data.damageReduction;
		}

		// if item is dragged from one hand to another, sourceBoxIndex is null
		if (sourceBoxIndex) {
			tempAllItemsList.splice(+sourceBoxIndex[0], 1, null);
		}
		props.updateInventory(props.characterInfo.id, tempAllItemsList, () => {
			props.updateCharacters('player', updateData, props.characterInfo.id, false, false);
		});
	};
	const dropItemToInv = (e) => {
		e.preventDefault();
		if (notEnoughSpaceInInventory(1, 0, props.characterInfo)) {
			props.setShowDialogProps(true, notEnoughSpaceDialogProps);
			return;
		}

		let draggingEquippedItem = false;
		if (equippedItems.armor === draggedItem.id) {
			updateData.equippedItems.armor = '';
			updateData.defense = props.characterInfo.calculateDefense();
			updateData.damageReduction = 0;
		} else if (equippedItems.loadout1.left === draggedItem.id) {
			updateData.equippedItems.loadout1.left = '';
			draggingEquippedItem = true;
		}
		// this is not an else if because a two handed weapon would take up both left and right
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

	const numItemsInLoadout1 = equippedIsTwoHanded || (equippedItems.loadout1.right && !equippedItems.loadout1.left) || (!equippedItems.loadout1.right && equippedItems.loadout1.left) ? 1 :
		(equippedItems.loadout1.right && equippedItems.loadout1.left && equippedItems.loadout1.right !== equippedItems.loadout1.left) ? 2 : 0;
	const numItemsInLoadout2 = (equippedItems.loadout2.right && equippedItems.loadout2.left && equippedItems.loadout2.right === equippedItems.loadout2.left) ||
		(equippedItems.loadout2.right && !equippedItems.loadout2.left) || (!equippedItems.loadout2.right && equippedItems.loadout2.left) ? 1 :
		(equippedItems.loadout2.right && equippedItems.loadout2.left && equippedItems.loadout2.right !== equippedItems.loadout2.left) ? 2 : 0;
	return (
		<div className={`character-info-container ui-panel ${props.characterIsSelected ? '' : 'hide'}`}>
			<div className='char-info-header'>
				<div>
					<div>Name: {props.characterInfo.name}</div>
					<div>Profession: {props.characterInfo.profession}</div>
				</div>
				<div>
					<div>Health: {props.characterInfo.currentHealth} / {props.characterInfo.startingHealth}</div>
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
								id={equippedIsTwoHanded ? equippedItems.loadout1.right + '-2handed' :
									equippedItems.loadout1.right ? equippedItems.loadout1.right : 'right-hand'}
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
								id={equippedIsTwoHanded ? equippedItems.loadout1.left + '-2handed' :
									equippedItems.loadout1.left ? equippedItems.loadout1.left : 'left-hand'}
								className={`${convertObjIdToClassId(equippedItems.loadout1.left)}-inv`}
								draggable={true}
								onDragStart={(e) => {dragItem(e, equippedItems.loadout1.left)}}
							>{equippedItems.loadout1.left ? '' : 'Left Hand'}</div>
						</div>
					</div>
					<div className='char-info-equip-toggle-button general-button' onClick={() => {
						if (!notEnoughSpaceInInventory(numItemsInLoadout1, numItemsInLoadout2, props.characterInfo)) {
							props.switchEquipment(props.characterInfo.id)
						} else {
							props.setShowDialogProps(true, notEnoughSpaceDialogProps);
						}
					}}>Switch equipment</div>
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
			<div>Health: {props.creatureInfo.currentHealth} / {props.creatureInfo.startingHealth}</div>
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
		props.inTacticalMode && props.threatList.length > 0 ? 'Enemies moving...' : 'Something creeps deep in the darkness...';

	return (
		<div>
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
					<div className='general-button' onClick={(e) => {
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

function HelpPopUp(props) {
	return (
		<div className='help-popup ui-panel'>

		</div>
	);
}

export {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, ModeInfoPanel, DialogWindow};
