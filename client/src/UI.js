import React from 'react';
import {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, ObjectInfoPanel, ModeInfoPanel, DialogWindow} from './UIElements';
import {notEnoughSpaceInInventory, deepCopy} from './Utils';
import './css/ui.css';

class UI extends React.Component {
	constructor(props) {
		super(props);

		this.uiPanelHeight = 95;
		this.objectPanelWidth = 300;
		this.objectPanelHeight = 250;
		this.inventoryLength = 12;

		this.notEnoughSpaceDialogProps = {
			dialogContent: `There is not enough inventory space to do that.`,
			closeButtonText: 'Ok',
			closeButtonCallback: null,
			disableCloseButton: false,
			actionButtonVisible: false,
			actionButtonText: '',
			actionButtonCallback: null,
			dialogClasses: ''
		};

		this.uiRefs = {
			controlBar: React.createRef(),
			turnInfo: React.createRef(),
			log: React.createRef()
		};

		this.state = {
			logText: this.props.logText,
			controlBarMinimized: false,
			logMinimized: false,
			modeMinimized: false,
			entireInventory: {},
			objectIsSelected: false,
			selectedObjPos: {},
			objectSelected: {},
			needToShowObjectPanel: false
		};
	}

	showDialog = () => {
		return (
			<DialogWindow
				classes={this.props.dialogProps.dialogClasses}
				dialogContent={this.props.dialogProps.dialogContent}
				closeButtonText={this.props.dialogProps.closeButtonText}
				closeButtonCallback={this.props.dialogProps.closeButtonCallback}
				disableCloseButton={this.props.dialogProps.disableCloseButton}
				actionButtonVisible={this.props.dialogProps.actionButtonVisible}
				actionButtonText={this.props.dialogProps.actionButtonText}
				actionButtonCallback={this.props.dialogProps.actionButtonCallback}
				closeDialogCallback={this.closeDialog} />
		)
	}

	closeDialog = () => {
		this.props.setShowDialogProps(false);
	}

	addLogLines = () => {
		let lines = [];
		let i = 0;
		this.state.logText.forEach(line => {
			lines.push(<div key={i} className='log-line'>{line}</div>);
			i++;
		});

		return lines;
	}

	scrollLog = () => {
		const logLinesContainer = this.uiRefs.log.current.children[0];
		logLinesContainer.scroll({top: logLinesContainer.scrollHeight, behavior: 'smooth'});
	}

	minimizePanel = (refName) => {
		const panelStateName = refName + 'Minimized';
		if (this.state[panelStateName]) {
			this.uiRefs[refName].current.style = 'transform: translateY(0)';
		} else if (refName === 'controlBar') {
			this.uiRefs[refName].current.style = `transform: translateY(${this.uiPanelHeight}px)`;
		} else if (refName === 'turnInfo') {
			this.uiRefs[refName].current.style = `transform: translateY(-${this.uiPanelHeight}px)`;
		}
		this.setState(prevState => ({[panelStateName]: !prevState[panelStateName]}));
	}

	dropItemToPC = (evt, draggedItem, recipientId, clearDraggedItem) => {
		const allPCdata = deepCopy(this.props.playerCharacters);
		const sourcePCdata = allPCdata[draggedItem.sourcePC];
		const currentPCdata = allPCdata[recipientId];
		const allPlayersInv = deepCopy(this.state.entireInventory);
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
			const sourceBoxIndex = draggedItem.sourceLoc.match(/\d+/);
			const firstOpenInvSlot = allPlayersInv[recipientId].indexOf(null);
			const invObjectCategory = draggedItem.data.itemType ? 'items' : 'weapons';
			let invId = draggedItem.data.id;
			const updateCurrentAndSourceData = (sourceItemCount) => {
				// now add item to inv shown in char info panel
				if (!allPlayersInv[recipientId].includes(invId) && currentPCdata.equippedItems.loadout1.right !== invId && currentPCdata.equippedItems.loadout1.left !== invId) {
					allPlayersInv[recipientId].splice(firstOpenInvSlot, 1, invId);
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

				allPCdata[recipientId] = currentPCdata;
				allPCdata[draggedItem.sourcePC] = sourcePCdata;
				this.updateInventory(null, allPlayersInv, () => {
					this.props.updateCharacters('player', allPCdata, null, false, false, () => {
						clearDraggedItem();
					});
				});
			}

			// add dragged item to current pc inv
			if (draggedItem.data.stackable) {
				this.setObjectSelected(draggedItem.data, evt, true, (draggedItemCount, sourceItemCount) => {
					if (draggedItem) {
						// for stackable items, need to update count from object panel split
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
			this.props.setShowDialogProps(true, dialogProps);
		}
	}

	dropItemToEquipped = (evt, draggedItem, clearDraggedItem) => {
		const targetClasses = evt.target.className;
		const parentClasses = evt.target.parentElement.className;
		// don't know which hand dragged to and don't know if that hand already has an item equipped (if it doesn't, target class would include the "box" class)
		const destination = targetClasses.includes('-arm') ? 'hand-swap' : parentClasses.includes('-arm') ? 'hand' : 'body';

		// if item is dragged and released on its own box, dragged to a hand and is a non-light item (not including weapons), or dragged to body and isn't armor, exit out
		if (parentClasses === draggedItem.sourceClasses ||
			(destination.includes('hand') && (draggedItem.data.itemType && draggedItem.data.itemType !== 'Light')) ||
			(destination === 'body' && (!draggedItem.data.itemType || draggedItem.data.itemType !== 'Armor')))
		{
			clearDraggedItem();
			return;
		}

		let hand = '';
		let oppositeHand = '';
		const updateData = deepCopy(this.props.selectedCharacterInfo);
		const inventoryItems = this.state.entireInventory[this.props.selectedCharacterInfo.id];
		let tempAllItemsList = [...inventoryItems];
		const sourceBoxIndex = draggedItem.sourceLoc.match(/\d+/);
		const loadout1 = updateData.equippedItems.loadout1;

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
			if (loadout1.right && loadout1.left && loadout1.right !== loadout1.left && notEnoughSpaceInInventory(2, 1, this.props.selectedCharacterInfo)) {
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
				this.props.setShowDialogProps(true, dialogProps);
				return;
			}
			updateData.equippedItems.loadout1[hand] = draggedItem.data.id;
			updateData.equippedItems.loadout1[oppositeHand] = draggedItem.data.id;
		// or if we're replacing a two-handed item with a one-handed item
		} else if (hand && loadout1.right && loadout1.right === loadout1.left) {
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
			updateData.defense = this.props.selectedCharacterInfo.calculateDefense();
			updateData.damageReduction = draggedItem.data.damageReduction;
		}

		// if item is dragged from one hand to another, sourceBoxIndex is null
		if (sourceBoxIndex) {
			tempAllItemsList.splice(+sourceBoxIndex[0], 1, null);
		}

		this.updateInventory(this.props.selectedCharacterInfo.id, tempAllItemsList, () => {
			this.props.updateCharacters('player', updateData, this.props.selectedCharacterInfo.id, false, false);
			clearDraggedItem();
		});
	}

	dropItemToInv = (evt, draggedItem, clearDraggedItem) => {
		if (notEnoughSpaceInInventory(1, 0, this.props.selectedCharacterInfo)) {
			this.props.setShowDialogProps(true, this.notEnoughSpaceDialogProps);
			return;
		}

		const updateData = deepCopy(this.props.selectedCharacterInfo);
		const equippedItems = updateData.equippedItems;
		const inventoryItems = this.state.entireInventory[this.props.selectedCharacterInfo.id];

		let draggingEquippedItem = false;
		if (equippedItems.armor === draggedItem.data.id) {
			updateData.equippedItems.armor = '';
			updateData.defense = this.props.selectedCharacterInfo.calculateDefense();
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
			this.props.updateCharacters('player', updateData, this.props.selectedCharacterInfo.id, false, false);
		} else {
			let tempAllItemsList = [...inventoryItems];
			const targetIsBox = evt.target.id.includes('invBox');
			const targetId = +evt.target.id.match(/\d+/)[0];
			const parentId = !targetIsBox ? +evt.target.parentElement.id.match(/\d+/)[0] : null;
			const destBoxIndex = targetIsBox ? targetId : parentId;
			const destBoxContents = tempAllItemsList[destBoxIndex];
			const sourceBoxIndex = +draggedItem.sourceLoc.match(/\d+/)[0];

			// replace contents of destination spot with dragged item
			tempAllItemsList.splice(destBoxIndex, 1, draggedItem.data.id);
			// replace contents of source spot with replaced destination item
			tempAllItemsList.splice(sourceBoxIndex, 1, destBoxContents);
			this.updateInventory(this.props.selectedCharacterInfo.id, tempAllItemsList);
		}
		clearDraggedItem();
	}

	showControlBar = () => {
		let controlPanels = [];

		for (const [id, playerInfo] of Object.entries(this.props.playerCharacters)) {
			controlPanels.push(
				<CharacterControls
					key={id}
					playerCharacters={this.props.playerCharacters}
					characterId={id}
					characterName={playerInfo.name}
					equippedItems={playerInfo.equippedItems}
					invItems={playerInfo.items}
					toggleActionButton={this.props.toggleActionButton}
					actionButtonSelected={this.props.actionButtonSelected}
					isActiveCharacter={id === this.props.activeCharacter}
					movesRemaining={this.props.playerLimits.moves - this.props.actionsCompleted.moves}
					actionsRemaining={this.props.playerLimits.actions - this.props.actionsCompleted.actions}
					inTacticalMode={this.props.inTacticalMode}
					updateCharacters={this.props.updateCharacters}
					entireInventory={this.state.entireInventory}
					updateInventory={this.updateInventory}
					checkForExtraAmmo={this.checkForExtraAmmo}
					reloadGun={this.props.reloadGun}
					setShowDialogProps={this.props.setShowDialogProps}
					setObjectSelected={this.setObjectSelected}
					dropItemToPC={this.dropItemToPC}
				/>
			)
		}
		return controlPanels;
	}

	/**
	 * Store whether an object in inv or on the map has been selected (or if callback is passed, item is being dragged instead)
	 * @param objectSelected
	 * @param evt
	 * @param needToShowObjectPanel
	 * @param objPanelCallback
	 */
	setObjectSelected = (objectSelected, evt, needToShowObjectPanel, objPanelCallback) => {
		const buffer = 30;
		const leftMod = evt && evt.clientX > (window.innerWidth - this.objectPanelWidth) ? -(this.objectPanelWidth + buffer) : 0;
		const topMod = evt && evt.clientY < (window.screenTop + this.objectPanelHeight) ? buffer : -this.objectPanelHeight;
		const selectedObjPos = evt ? {left: evt.clientX + leftMod, top: evt.clientY + topMod} : this.state.selectedObjPos ? {...this.state.selectedObjPos} : null;
		const objectIsSelected = objectSelected !== null;
		this.setState({objectSelected, objectIsSelected, selectedObjPos, needToShowObjectPanel, objPanelCallback}, () => {
			// if object info panel is closed by clicking cancel/X button
			if (!objectIsSelected && this.props.objectSelected) {
				this.props.setObjectSelected(null);
			}
			if (this.props.objHasBeenDropped) {
				this.props.setHasObjBeenDropped(false);
			}
		});
	}

	showObjectPanel = () => {
		return (
			<ObjectInfoPanel
				objectInfo={this.state.objectSelected}
				setObjectSelected={this.setObjectSelected}
				selectedObjPos={this.state.selectedObjPos}
				objHasBeenDropped={this.props.objHasBeenDropped}
				objPanelCallback={this.state.objPanelCallback}
			/>
		)
	}

	switchEquipment = (id) => {
		const updateData = deepCopy(this.props.playerCharacters[id]);
		const loadout2 = updateData.equippedItems.loadout2;
		const leftHandHasLight = updateData.items[loadout2.left] && updateData.items[loadout2.left].itemType === 'Light';
		const rightHandHasLight = updateData.items[loadout2.right] && updateData.items[loadout2.right].itemType === 'Light';
		let tempAllItemsList = [...this.state.entireInventory[id]];

		if (updateData.equippedLight || leftHandHasLight || rightHandHasLight) {
			updateData.equippedLight = leftHandHasLight ? loadout2.left : rightHandHasLight ? loadout2.right : null;
			updateData.lightRange = updateData.equippedLight ? updateData.items[updateData.equippedLight].range : 0;
		}
		updateData.equippedItems.loadout2 = {...updateData.equippedItems.loadout1};
		updateData.equippedItems.loadout1 = {...loadout2};

		for (const itemId of Object.values(updateData.equippedItems.loadout1)) {
			const itemBox = tempAllItemsList.indexOf(itemId);
			tempAllItemsList.splice(itemBox, 1, null);
		}
		this.updateInventory(id, tempAllItemsList, () => {
			const updatedData = {
				equippedItems: updateData.equippedItems,
				equippedLight: updateData.equippedLight,
				lightRange: updateData.lightRange
			};
			this.props.updateCharacters('player', updatedData, id, false, false);
		})
	}

	/**
	 *
	 * @param currentPCdata: object (all char info, from CharacterControls in UIElements)
	 * @returns {boolean}
	 */
	checkForExtraAmmo = (currentPCdata) => {
		let hasExtraAmmo = false;
		const equippedItems = currentPCdata.equippedItems.loadout1;
		const gunInfo = currentPCdata.weapons[equippedItems.left] || currentPCdata.weapons[equippedItems.right];
		const equippedGunType = gunInfo && gunInfo.gunType;
		if (equippedGunType) {
			const itemsInfo= Object.values(currentPCdata.items);
			let itemNum = 0;
			while (!hasExtraAmmo && itemNum < itemsInfo.length) {
				if (itemsInfo[itemNum].itemType === 'Ammo' && itemsInfo[itemNum].gunType === equippedGunType) {
					hasExtraAmmo = true;
				} else {
					itemNum++;
				}
			}
		}
		return hasExtraAmmo;
	}

	/**
	 *
	 * @param id: string (pc ID)
	 * @param updatedList: array (of item/weapon IDs)
	 * @param callback
	 */
	updateInventory = (id, updatedList, callback) => {
		let updatedInv = this.state.entireInventory;
		if (id) {
			updatedInv[id] = updatedList;
		} else {
			updatedInv = updatedList;
		}
		this.setState({entireInventory: updatedInv}, () => {
			if (callback) callback();
		});
	}

	/**
	 * For setting up/updating player inventory (not the stored inventory from App) shown in the char info panel
	 * @param charId: string
	 * @param invItemsList: array of itemIds (or null if no item in that slot)
	 * @private
	 */
	_parseInvItems(charId, invItemsList){
		const charInfo = this.props.playerCharacters[charId];
		const allItems = Object.assign({...charInfo.weapons}, {...charInfo.items});
		const equippedItems = charInfo.equippedItems;
		let tempInvList = [...invItemsList];

		for (const itemId of Object.keys(allItems)) {
			if (itemId !== equippedItems.loadout1.right && itemId !== equippedItems.loadout1.left && itemId !== equippedItems.armor && tempInvList.indexOf(itemId) === -1) {
				const emptyBoxId = tempInvList.indexOf(null);
				tempInvList.splice(emptyBoxId, 1, itemId);
			}
		}

		// remove from inv list any items that are no longer among character's items/weapons
		tempInvList.forEach((id, index) => {
			if (!allItems[id]) {
				tempInvList.splice(index, 1, null);
			}
		});

		// need to fill in the rest of the inv slots with null, so char info panel shows empty boxes
		let updatedInventory = [];
		for (let i=0; i < this.inventoryLength; i++) {
			updatedInventory.push(tempInvList[i] || null);
		}
		this.updateInventory(charId, updatedInventory);
	}

	componentDidMount() {
		if (Object.keys(this.state.entireInventory).length === 0) {
			for (const id of Object.keys(this.props.playerCharacters)) {
				this._parseInvItems(id, []);
			}
		}
	}

	componentDidUpdate(prevProps, prevState, snapShot) {
		if (prevProps.logText !== this.props.logText) {
			this.setState({logText: [...this.props.logText]}, this.scrollLog);
		}
		if (this.props.selectedCharacterInfo && prevProps.selectedCharacterInfo !== this.props.selectedCharacterInfo) {
			this._parseInvItems(this.props.selectedCharacterInfo.id, this.state.entireInventory[this.props.selectedCharacterInfo.id]);
		}
		if (this.props.objectSelected && prevProps.objectSelected !== this.props.objectSelected) {
			if (!prevProps.objectSelected || prevProps.objectSelected.object.id !== this.props.objectSelected.object.id) {
				const objectInfo = {...this.props.objectSelected.object, isMapObj: true};
				this.setObjectSelected(objectInfo, this.props.objectSelected.evt, true);
			} else {
				this.setObjectSelected(null, this.props.objectSelected.evt, false);
			}
		}
		if (!prevProps.objHasBeenDropped && this.props.objHasBeenDropped) {
			this.setObjectSelected({...this.state.objectSelected}, null, true);
		}
	}

	render() {
		return (
			<div className='ui-container'>
				{this.props.showDialog && this.props.dialogProps && <this.showDialog />}

				{this.state.objectIsSelected && this.state.needToShowObjectPanel && <this.showObjectPanel />}

				<div ref={this.uiRefs.turnInfo} className='turn-info-container ui-panel'>
					<div ref={this.uiRefs.log} className='log-container'>
						{this.state.logText &&
							<div className='log-lines'>
								<this.addLogLines />
							</div>
						}
					</div>

					<div className='mode-info-container'>
						{this.props.modeInfo &&
							<ModeInfoPanel
								inTacticalMode={this.props.modeInfo.inTacticalMode}
								toggleTacticalMode={this.props.toggleTacticalMode}
								threatList={this.props.threatList}
								isPartyNearby={this.props.isPartyNearby}
								setShowDialogProps={this.props.setShowDialogProps}
								players={this.props.playerCharacters}
								activeCharacter={this.props.activeCharacter}
								updateActiveCharacter={this.props.updateActiveCharacter}
								updateFollowModeMoves={this.props.updateFollowModeMoves}
								endTurnCallback={this.props.updateCurrentTurn}
								toggleActionButton={this.props.toggleActionButton}
								updateUnitSelectionStatus={this.props.updateUnitSelectionStatus}
								characterIsSelected={this.props.characterIsSelected}
								characterInfo={this.props.selectedCharacterInfo}
								creatureIsSelected={this.props.creatureIsSelected}
								creatureInfo={this.props.selectedCreatureInfo}
							/>
						}
					</div>
					{/*<div className='minimize-button general-button' onClick={() => {*/}
					{/*	this.minimizePanel('turnInfo');*/}
					{/*}}>_</div>*/}
				</div>

				{this.props.selectedCharacterInfo && this.state.entireInventory &&
					<CharacterInfoPanel
						characterIsSelected={this.props.characterIsSelected}
						updateUnitSelectionStatus={this.props.updateUnitSelectionStatus}
						characterInfo={this.props.selectedCharacterInfo}
						switchEquipment={this.switchEquipment}
						updateCharacters={this.props.updateCharacters}
						entireInventory={this.state.entireInventory}
						updateInventory={this.updateInventory}
						setShowDialogProps={this.props.setShowDialogProps}
						setObjectSelected={this.setObjectSelected}
						dropItemToInv={this.dropItemToInv}
						dropItemToEquipped={this.dropItemToEquipped}
						notEnoughSpaceDialogProps={this.notEnoughSpaceDialogProps}
					/>
				}

				{this.props.selectedCreatureInfo &&
					<CreatureInfoPanel
						creatureIsSelected={this.props.creatureIsSelected}
						updateUnitSelectionStatus={this.props.updateUnitSelectionStatus}
						creatureInfo={this.props.selectedCreatureInfo}
					/>
				}

				<div ref={this.uiRefs.controlBar} className='control-bar-container ui-panel'>
					{/*<div className='minimize-button general-button' onClick={() => {*/}
					{/*	this.minimizePanel('controlBar');*/}
					{/*}}>_</div>*/}
					{this.props.playerCharacters && <this.showControlBar />}
				</div>
			</div>
		);
	}
}

export default UI;
