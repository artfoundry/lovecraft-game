import React from 'react';
import {convertObjIdToClassId, notEnoughSpaceInInventory} from './Utils';

let draggedItem = null;
let draggedItemSourceLoc = null;
let draggedItemSourceClasses = null;

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
			const invObjectCategory = draggedItem.data.itemType ? 'items' : 'weapons';
			let invId = draggedItem.data.id;
			const updateCurrentAndSourceData = (sourceItemCount) => {
				// now add item to inv shown in char info panel
				if (!allPlayersInv[props.characterId].includes(invId) && currentPCdata.equippedItems.loadout1.right !== invId && currentPCdata.equippedItems.loadout1.left !== invId) {
					allPlayersInv[props.characterId].splice(firstOpenInvSlot, 1, invId);
				}

				// remove dragged item from source pc inv if it's a single object or an entire stack (of ammo, oil, etc.)
				if (!draggedItem.data.stackable || sourceItemCount === 0) {
					// if no source box index, then it was dragged from being equipped
					if (sourceBoxIndex) {
						allPlayersInv[draggedItem.sourcePC].splice(+sourceBoxIndex[0], 1, null);
					}
					delete sourcePCdata[invObjectCategory][invId];
					if (sourcePCdata.equippedItems.loadout1.left === invId) {
						sourcePCdata.equippedItems.loadout1.left = '';
					}
					// this is not an else if because a two handed weapon would take up both left and right
					if (sourcePCdata.equippedItems.loadout1.right === invId) {
						sourcePCdata.equippedItems.loadout1.right = '';
					}
					if (sourcePCdata.equippedLight === invId) {
						sourcePCdata.equippedLight = null;
						sourcePCdata.lightRange = 0;
					}
				// otherwise just update its item count
				} else if (sourceItemCount > 0) {
					if (draggedItem.data.gunType || invObjectCategory === 'items') {
						sourcePCdata[invObjectCategory][invId].amount = sourceItemCount;
					} else {
						sourcePCdata[invObjectCategory][invId].currentRounds = sourceItemCount;
					}
				}

				allPCdata[props.characterId] = currentPCdata;
				allPCdata[draggedItem.sourcePC] = sourcePCdata;
				props.updateCharacters('player', allPCdata, null, false, false, () => {
					// sourcePc inv update should be handled by UI from componentDidUpdate -> _parseInvItems
					props.updateInventory(props.characterId, allPlayersInv[props.characterId]);
				});
			}

			// add dragged item to current pc inv
			if (draggedItem.data.stackable) {
				props.setObjectSelected(draggedItem.data, e, (draggedItemCount, sourceItemCount) => {
					if (draggedItem) {
						// for stackable items, need to update count from object planel split
						if (draggedItem.data.gunType || invObjectCategory === 'items') {
							draggedItem.data.amount = draggedItemCount;
						} else {
							draggedItem.data.currentRounds = draggedItemCount;
						}

						// gun ammo
						if (draggedItem.data.gunType) {
							if (!currentPCdata.items[invId]) {
								currentPCdata.items[invId] = {...draggedItem.data};
							} else {
								currentPCdata.items[invId].amount += draggedItem.data.amount;
							}
						} else {
							if (!currentPCdata[invObjectCategory][invId]) {
								currentPCdata[invObjectCategory][invId] = {...draggedItem.data};
							} else if (invObjectCategory === 'weapons'){
								currentPCdata.weapons[invId].currentRounds += draggedItem.data.currentRounds;
							} else {
								currentPCdata.items[invId].amount += draggedItem.data.amount;
							}
						}
						updateCurrentAndSourceData(sourceItemCount);
					}
				});
			} else {
				currentPCdata[invObjectCategory][draggedItem.data.id] = {...draggedItem.data};
				updateCurrentAndSourceData();
			}
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
				const weaponButtonIndex = actionableItems.weapons.findIndex(listItem => listItem.weaponName === weaponInfo.name);
				if (weaponInfo.gunType) {
					actionableItems.weapons.push({weaponId: itemId, weaponName: weaponInfo.name, isGun: true, ammo: weaponInfo.currentRounds});
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

	const handleWeaponClick = (weapon) => {
		const ammoId = currentPCdata.weapons[weapon.weaponId].gunType + 'Ammo0';
		if (weapon.ammo === 0) {
			// if all extra ammo used up, update inventory in UI
			const gunInfo = currentPCdata.weapons[weapon.weaponId];
			let availAmmo = currentPCdata.items[gunInfo.gunType + 'Ammo0'].amount;
			if (availAmmo <= gunInfo.rounds) {
				const updatedInventory = props.entireInventory[props.characterId];
				const ammoInvIndex = updatedInventory.indexOf(ammoId);
				updatedInventory.splice(ammoInvIndex, 1);
				props.updateInventory(props.characterId, updatedInventory, () => {
					props.reloadGun(weapon, gunInfo, availAmmo, currentPCdata);
				});
			}
		} else {
			props.toggleActionButton(props.characterId, weapon.weaponId, weapon.weaponName, 'weapon');
		}
	};
	const hasExtraAmmo = props.checkForExtraAmmo(currentPCdata);

	const weaponButtons = (
		<div className='action-buttons-container'>
			{actionableItems.weapons.map((weapon, index) => {
				actionButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0 || (weapon.ammo === 0 && !hasExtraAmmo)) ? 'button-inactive' :
					(props.isActiveCharacter && props.actionButtonSelected.characterId === props.characterId && props.actionButtonSelected.itemId === weapon.weaponId) ? 'button-selected': '';
				return (
					<div
						className={`action-button ${convertObjIdToClassId(weapon.weaponId)}-act ${actionButtonState} ${weapon.ammo === 0 ? 'gun-reload-icon' : ''}`}
						key={weapon.weaponId}
						onClick={() => {
							handleWeaponClick(weapon);
						}}
					>{weapon.ammo || ''}</div>
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
						(props.isActiveCharacter && props.actionButtonSelected.characterId === props.characterId && props.actionButtonSelected.itemId === item.itemId) ? 'button-selected': '';
					button = (
						<div className={`action-button ${convertObjIdToClassId(item.itemId)}-act ${actionButtonState}`} key={item.itemId} onClick={() => {
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
	const inventoryItems = props.entireInventory[props.characterInfo.id];
	const notEnoughSpaceDialogProps = {
		dialogContent: `There is not enough inventory space to do that.`,
		closeButtonText: 'Ok',
		closeButtonCallback: null,
		disableCloseButton: false,
		actionButtonVisible: false,
		actionButtonText: '',
		actionButtonCallback: null,
		dialogClasses: ''
	};
	const dragItem = (e) => {
		const itemId = e.target.id.includes('-leftHand') ? e.target.id.slice(0, e.target.id.indexOf('-leftHand')) : e.target.id;
		draggedItem = {data: updateData.items[itemId] || updateData.weapons[itemId], sourcePC: updateData.id};
		draggedItemSourceLoc = e.target.parentElement.id; //only used if being dragged from inv (not from equipped)
		draggedItemSourceClasses = e.target.parentElement.className;
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

		// if item is dragged and released on its own box, dragged to a hand and is a non-light item (not including weapons), or dragged to body and isn't armor, exit out
		if (parentClasses === draggedItemSourceClasses ||
			(destination.includes('hand') && (draggedItem.data.itemType && draggedItem.data.itemType !== 'Light')) ||
			(destination === 'body' && (!draggedItem.data.itemType || draggedItem.data.itemType !== 'Armor')))
		{
			return;
		}

		let hand = '';
		let oppositeHand = '';
		let tempAllItemsList = [...inventoryItems];
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
			updateData.equippedLight = draggedItem.data.id;
			updateData.lightRange = draggedItem.data.range;
		// or if an equipped light is being unequipped (and not by a light)
		} else if (hand && sourceBoxIndex && (loadout1[hand] === updateData.equippedLight ||
			(draggedItem.data.twoHanded && loadout1[oppositeHand] === updateData.equippedLight)))
		{
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
			updateData.equippedItems.loadout1[hand] = draggedItem.data.id;
			updateData.equippedItems.loadout1[oppositeHand] = draggedItem.data.id;
		// or if we're replacing a two-handed item with a one-handed item
		} else if (hand && equippedIsTwoHanded) {
			updateData.equippedItems.loadout1[hand] = draggedItem.data.id;
			updateData.equippedItems.loadout1[oppositeHand] = '';
		// or we're just equipping a one-handed item
		} else if (hand) {
			// if item is dragged from one hand to another, sourceBoxIndex is null
			if (!sourceBoxIndex) {
				updateData.equippedItems.loadout1[oppositeHand] = updateData.equippedItems.loadout1[hand];
			}
			updateData.equippedItems.loadout1[hand] = draggedItem.data.id;
		// or we're equipping a body item
		} else if (destination === 'body') {
			updateData.equippedItems.armor = draggedItem.data.id;
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
		if (equippedItems.armor === draggedItem.data.id) {
			updateData.equippedItems.armor = '';
			updateData.defense = props.characterInfo.calculateDefense();
			updateData.damageReduction = 0;
			draggingEquippedItem = true;
		} else if (equippedItems.loadout1.left === draggedItem.data.id) {
			updateData.equippedItems.loadout1.left = '';
			draggingEquippedItem = true;
		}

		// this is not an else if because a two handed weapon would take up both left and right
		if (equippedItems.loadout1.right === draggedItem.data.id) {
			updateData.equippedItems.loadout1.right = '';
			draggingEquippedItem = true;
		}

		if (draggedItem.data.itemType && draggedItem.data.itemType === 'Light' && updateData.equippedLight === draggedItem.data.id) {
			updateData.equippedLight = null;
			updateData.lightRange = 0;
			draggingEquippedItem = true;
		}

		if (draggingEquippedItem) {
			props.updateCharacters('player', updateData, props.characterInfo.id, false, false);
		} else {
			let tempAllItemsList = [...inventoryItems];
			const targetIsBox = e.target.id.includes('invBox');
			const targetId = +e.target.id.match(/\d+/)[0];
			const parentId = !targetIsBox ? +e.target.parentElement.id.match(/\d+/)[0] : null;
			const destBoxIndex = targetIsBox ? targetId : parentId;
			const destBoxContents = tempAllItemsList[destBoxIndex];
			const sourceBoxIndex = +draggedItemSourceLoc.match(/\d+/)[0];

			// replace contents of destination spot with dragged item
			tempAllItemsList.splice(destBoxIndex, 1, draggedItem.data.id);
			// replace contents of source spot with replaced destination item
			tempAllItemsList.splice(sourceBoxIndex, 1, destBoxContents);
			props.updateInventory(props.characterInfo.id, tempAllItemsList);
		}
	};
	const itemsIntoElements = (
		<div className='char-info-inv-items'>
			{inventoryItems.map((itemId, index) => {
				const itemInfo = props.characterInfo.weapons[itemId] || props.characterInfo.items[itemId];
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
								className={`inv-object ${convertObjIdToClassId(itemId)}-inv`}
								draggable={true}
								onDragStart={(e) => {dragItem(e, itemId)}}
								onClick={(e) => {props.setObjectSelected({...itemInfo, id: itemId}, e)}}
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

	return (
		<div className={`character-info-container ui-panel`}>
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
					<div className='char-info-doll-boxes-container'>
						<div
							className='char-info-paper-doll-body char-info-paper-doll-box'
							onDragOver={(e) => {handleItemOverDropZone(e)}}
							onDrop={(e) => {dropItemToEquipped(e)}}
						>
							{(equippedItems.armor &&
							<div
								id={equippedItems.armor ? equippedItems.armor : 'body'}
								className={`inv-object ${convertObjIdToClassId(equippedItems.armor)}-inv`}
								draggable={true}
								onDragStart={(e) => {dragItem(e, equippedItems.armor)}}
								onClick={(e) => {props.setObjectSelected({...itemsPossessed[equippedItems.armor], id: equippedItems.armor}, e)}}
							></div>) || 'Body'}
						</div>

						<div
							className='char-info-paper-doll-right-arm char-info-paper-doll-box'
							onDragOver={(e) => {handleItemOverDropZone(e)}}
							onDrop={(e) => {dropItemToEquipped(e)}}
						>
							{(equippedItems.loadout1.right &&
							<div
								id={equippedItems.loadout1.right ? equippedItems.loadout1.right : 'right-hand'}
								className={`inv-object ${convertObjIdToClassId(equippedItems.loadout1.right)}-inv`}
								draggable={true}
								onDragStart={(e) => {dragItem(e, equippedItems.loadout1.right)}}
								onClick={(e) => {props.setObjectSelected({...rightEquippedItemInfo, id: equippedItems.loadout1.right}, e)}}
							>{equippedItems.loadout1.right ? rightItemAmount : ''}</div>) || 'Right Hand'}
						</div>

						<div
							className='char-info-paper-doll-left-arm char-info-paper-doll-box'
							onDragOver={(e) => {handleItemOverDropZone(e)}}
							onDrop={(e) => {dropItemToEquipped(e)}}
						>
							{(equippedItems.loadout1.left &&
							<div
								id={equippedIsTwoHanded ? equippedItems.loadout1.left + '-leftHand' :
									equippedItems.loadout1.left ? equippedItems.loadout1.left : 'left-hand'}
								className={`inv-object ${convertObjIdToClassId(equippedItems.loadout1.left)}-inv`}
								draggable={true}
								onDragStart={(e) => {dragItem(e, equippedItems.loadout1.left)}}
								onClick={(e) => {props.setObjectSelected({...leftEquippedItemInfo, id: equippedItems.loadout1.left}, e)}}
							>{equippedItems.loadout1.left ? leftItemAmount : ''}</div>) || 'Left Hand'}
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
					<div>Defense: {props.characterInfo.defense}</div>
					<div>Damage Reduction: {props.characterInfo.damageReduction}{equippedItems.armor ? ` (from ${itemsPossessed[equippedItems.armor].name})` : ''}</div>
					<div>Skills:
						<ul>{skillList}</ul>
					</div>
				</div>
			</div>

			<div className='char-info-equipped-light'>Equipped Light: {props.characterInfo.equippedLight ? `${equippedLight.name} (Time left: ${equippedLight.time})`: 'none'}</div>

			{itemsIntoElements}
		</div>
	);
}

function ObjectInfoPanel(props) {
	const {objectInfo, setObjectSelected, selectedObjPos, objPanelCallback} = {...props};

	const splitStack = (e) => {
		e.preventDefault();
		const splitValue = +e.target[0].value;
		const remainingCount = objectInfo.amount ? objectInfo.amount - splitValue : objectInfo.currentRounds - splitValue;

		setObjectSelected(null);
		objPanelCallback(splitValue, remainingCount);
	};

	const cancelObjPanel = () => {
		draggedItem = null;
		setObjectSelected(null);
	}

	return (
		<div className={`object-info-panel ${!selectedObjPos ? 'ui-panel' : ''}`} style={{left: selectedObjPos.left, top: selectedObjPos.top}}>
			<div className='general-button' onClick={() => cancelObjPanel()}>X</div>
			<div className='object-panel-container'>
				<div className={`inv-object ${convertObjIdToClassId(objectInfo.id)}-inv`}></div>
				<div className='object-text-container'>
					<div className='font-fancy'>{objectInfo.name}</div>
					<div>{objectInfo.itemType ? objectInfo.itemType : (objectInfo.ranged ? 'Ranged' : 'Melee') + ' weapon'}</div>
					{objectInfo.rounds && <div>Capacity: {objectInfo.rounds} rounds</div>}
					{(!objectInfo.isMapObj && objectInfo.amount && <div>Amount: {objectInfo.amount}</div>) ||
						(!objectInfo.isMapObj && objectInfo.currentRounds >= 0 && <div>Rounds remaining: {objectInfo.currentRounds}</div>)}
					{objectInfo.twoHanded && <div>Two-handed</div>}
					{objectInfo.damage && <div>Damage: {objectInfo.damage}</div>}
					{!objectInfo.isMapObj && objectInfo.time && <div>Light remaining: {objectInfo.time} steps</div>}
					<div>{objectInfo.description}</div>
				</div>
				{draggedItem && objectInfo.stackable &&
					<form className='object-split-buttons' onSubmit={(e) => splitStack(e)}>
						<label htmlFor='object-split'>Move how many?</label>
						<input type='number' id='object-split' name='object-split' defaultValue='1' min='1' max={objectInfo.amount || objectInfo.currentRounds} />
						<button className='general-button' type='submit'>Move</button>
					</form>
				}
				{!objectInfo.isMapObj && !draggedItem &&
					<div className='object-panel-buttons'>
						<span className='general-button'>Equip Right Hand</span>
						<span className='general-button'>Equip Left Hand</span>
						<span className='general-button'>Unequip</span>
						<span className='general-button'>Drop</span>
						<span className='general-button'>Trade</span>
					</div>
				}
				<span className='general-button' onClick={() => cancelObjPanel()}>Cancel</span>
			</div>
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
					<div>Leader</div>
					<select name='leader' value={props.activeCharacter} onChange={e => {
						props.updateActiveCharacter(() => props.updateFollowModeMoves([]), e.target.value);
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

export {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, ObjectInfoPanel, ModeInfoPanel, DialogWindow};
