import React from 'react';
import {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, ObjectInfoPanel, ModeInfoPanel, DialogWindow, ContextMenu, HelpScreen, GameOptions} from './UIElements';
import {convertCoordsToPos, notEnoughSpaceInInventory, deepCopy} from './Utils';
import './css/ui.css';

class UI extends React.Component {
	constructor(props) {
		super(props);

		this.inventoryLength = 12;
		this.initialUiLoad = true;

		this.uiRefs = {
			controlBar: React.createRef(),
			turnInfo: React.createRef(),
			log: React.createRef()
		};
		this.audioSelectors = {
			music: {
				catacombs: {}
			}
		};

		this.state = {
			showGameOptions: false,
			showHelpScreen: false,
			logText: this.props.logText,
			controlBarMinimized: false,
			selectedControlTab: '',
			logMinimized: false,
			modeMinimized: false,
			entireInventory: {},
			objectIsSelected: false,
			selectedObjPos: {},
			objectSelected: {},
			draggedObjectMetaData: {},
			draggedObjRecipient: '',
			needToShowObjectPanel: false,
			isPickUpAction: false
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

	showControlBar = () => {
		let controlPanels = [];

		for (const [id, playerInfo] of Object.entries(this.props.playerCharacters)) {
			let mapObjectsOnPcTiles = [];
			for (const [objId, objInfo] of Object.entries(this.props.mapObjects)) {
				const xDelta = Math.abs(playerInfo.coords.xPos - objInfo.coords.xPos);
				const yDelta = Math.abs(playerInfo.coords.yPos - objInfo.coords.yPos);
				if (xDelta <= 1 && yDelta <= 1) {
					mapObjectsOnPcTiles.push({...objInfo, id: objId});
				}
			}

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
					refillLight={this.props.refillLight}
					setShowDialogProps={this.props.setShowDialogProps}
					dropItemToPC={this.dropItemToPC}
					setMapObjectSelected={this.props.setMapObjectSelected}
					mapObjectsOnPcTiles={mapObjectsOnPcTiles}
					screenData={this.props.screenData}
					selectedControlTab={this.state.selectedControlTab}
					setSelectedControlTab={this.setSelectedControlTab}
				/>
			)
		}
		return controlPanels;
	}

	setSelectedControlTab = (id) => {
		this.setState({selectedControlTab: id});
	}

	/**
	 * Control to minimize space taken up by a panel, so user can see more of the map
	 * NOTE: not currently in use
	 * @param refName: string (ref name for the panel)
	 */
	// minimizePanel = (refName) => {
	// 	const panelStateName = refName + 'Minimized';
	// 	if (this.state[panelStateName]) {
	// 		this.uiRefs[refName].current.style = 'transform: translateY(0)';
	// 	} else if (refName === 'controlBar') {
	// 		this.uiRefs[refName].current.style = `transform: translateY(${this.uiPanelHeight}px)`;
	// 	} else if (refName === 'turnInfo') {
	// 		this.uiRefs[refName].current.style = `transform: translateY(-${this.uiPanelHeight}px)`;
	// 	}
	// 	this.setState(prevState => ({[panelStateName]: !prevState[panelStateName]}));
	// }

	/**
	 * Remove dragged item from source pc inv if it's a single object or an entire stack (of ammo, oil, etc.)
	 * @param invObjectCategory
	 * @param sourceItemCount
	 * @param sourcePCdata
	 * @param allPlayersInv
	 * @param callback
	 */
	updateSourcePcInvAfterTransfer = (invObjectCategory, sourceItemCount, sourcePCdata, allPlayersInv, lightingChanged, callback = null) => {
		if (Object.keys(this.state.objectSelected).length === 0) {
			return;
		}
		const draggedItem = this.state.objectSelected;
		const draggedObjectMetaData = this.state.draggedObjectMetaData;
		const sourceBoxIndex = draggedObjectMetaData.sourceLoc.match(/\d+/);
		const invId = draggedItem.id;

		if (!draggedItem.stackable || sourceItemCount === 0) {
			// if no source box index, then it was dragged from being equipped and doesn't exist in allPlayersInv
			if (sourceBoxIndex) {
				allPlayersInv[draggedObjectMetaData.sourcePC].splice(+sourceBoxIndex[0], 1, null);
			}

			delete sourcePCdata[invObjectCategory][invId];
			if (sourcePCdata.equippedItems.armor === invId) {
				sourcePCdata.equippedItems.armor = '';
			} else if (sourcePCdata.equippedItems.loadout1.left === invId) {
				sourcePCdata.equippedItems.loadout1.left = '';
				if (draggedItem.twoHanded) {
					sourcePCdata.equippedItems.loadout1.right = '';
				}
			} else if (sourcePCdata.equippedItems.loadout1.right === invId) {
				sourcePCdata.equippedItems.loadout1.right = '';
			}
			if (sourcePCdata.equippedLight === invId) {
				sourcePCdata.equippedLight = null;
				sourcePCdata.lightRange = 0;
			}
		// otherwise just update its item count
		} else if (sourceItemCount > 0) {
			if (draggedItem.gunType || invObjectCategory === 'items') {
				sourcePCdata[invObjectCategory][invId].amount = sourceItemCount;
			} else {
				sourcePCdata[invObjectCategory][invId].currentRounds = sourceItemCount;
			}
		}

		this.updateInventory(null, allPlayersInv, () => {
			this.props.updateCharacters('player', sourcePCdata, draggedObjectMetaData.sourcePC, lightingChanged, false, false, callback);
		});
	}

	dropItemToPC = (evt, recipientId) => {
		const draggedItem = this.state.objectSelected;
		const draggedObjectMetaData = this.state.draggedObjectMetaData;
		const allPCdata = deepCopy(this.props.playerCharacters);
		const sourcePCdata = allPCdata[draggedObjectMetaData.sourcePC];
		const currentPCdata = allPCdata[recipientId];
		if (!draggedItem || draggedObjectMetaData.sourcePC === recipientId) {
			return;
		}
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
			dialogProps = this.props.notEnoughSpaceDialogProps;
		} else {
			const firstOpenInvSlot = allPlayersInv[recipientId].indexOf(null);
			const invObjectCategory = draggedItem.itemType ? 'items' : 'weapons';
			const invId = draggedItem.id;
			const lightingChanged = draggedItem.itemType && draggedItem.itemType === 'Light' && sourcePCdata.equippedLight === invId;

			// add dragged item to current pc inv
			if (draggedItem.stackable) {
				this.setObjectPanelDisplayOption(true, evt, recipientId);
			} else {
				currentPCdata[invObjectCategory][draggedItem.id] = {...draggedItem};
				// now add item to inv shown in char info panel
				if (!allPlayersInv[recipientId].includes(invId) && currentPCdata.equippedItems.loadout1.right !== invId && currentPCdata.equippedItems.loadout1.left !== invId) {
					allPlayersInv[recipientId].splice(firstOpenInvSlot, 1, invId);
				}

				this.updateSourcePcInvAfterTransfer(invObjectCategory, null, sourcePCdata, allPlayersInv, lightingChanged, () => {
					this.props.updateCharacters('player', currentPCdata, recipientId);
				});
			}
		}

		if (dialogProps) {
			this.props.setShowDialogProps(true, dialogProps);
		}
	}

	dropItemToEquipped = (evt) => {
		if (!this.state.objectSelected || Object.keys(this.state.objectSelected).length === 0) {
			return;
		}
		const draggedItem = this.state.objectSelected;
		const draggedObjectMetaData = this.state.draggedObjectMetaData;
		if (!draggedItem) return;
		const targetClasses = evt.target.className;
		const parentClasses = evt.target.parentElement.className;
		// don't know which hand dragged to and don't know if that hand already has an item equipped (if it doesn't, target class would include the "box" class)
		const destination = targetClasses.includes('-arm') ? 'hand-swap' : parentClasses.includes('-arm') ? 'hand' : 'body';
		let lightingChanged = false;

		// if item is dragged and released on its own box, dragged to a hand and is a non-light item (not including weapons), or dragged to body and isn't armor, exit out
		if (parentClasses === draggedObjectMetaData.sourceClasses ||
			(destination.includes('hand') && (draggedItem.itemType && draggedItem.itemType !== 'Light')) ||
			(destination === 'body' && (!draggedItem.itemType || draggedItem.itemType !== 'Armor')))
		{
			return;
		}

		let hand = '';
		let oppositeHand = '';
		const updateData = deepCopy(this.props.selectedCharacterInfo);
		const inventoryItems = this.state.entireInventory[this.props.selectedCharacterInfo.id];
		let tempAllItemsList = [...inventoryItems];
		const sourceBoxIndex = draggedObjectMetaData.sourceLoc.match(/\d+/);
		const loadout1 = updateData.equippedItems.loadout1;
		let lightBeingSwapped = null;
		let dialogProps = {};

		if (destination === 'hand-swap') {
			hand = targetClasses.includes('right') ? 'right' : 'left';
		} else if (destination === 'hand') {
			hand = parentClasses.includes('right') ? 'right' : 'left';
		}
		if (hand) {
			oppositeHand = hand === 'right' ? 'left' : 'right';
		}

		// if dragged item is a light
		if (draggedItem.itemType === 'Light') {
			// if light is already equipped and not just switching light to other hand
			if (updateData.equippedLight && sourceBoxIndex) {
				lightBeingSwapped = updateData.equippedLight;
				dialogProps = {
					dialogContent: 'That character already has an equipped light, and only one light may be equipped. Swapping the equipped one with this one.',
					closeButtonText: 'Ok',
					closeButtonCallback: null,
					disableCloseButton: false,
					actionButtonVisible: false,
					actionButtonText: '',
					actionButtonCallback: null,
					dialogClasses: ''
				}
				this.props.setShowDialogProps(true, dialogProps);
			}
			updateData.equippedLight = draggedItem.id;
			updateData.lightRange = draggedItem.range;
			updateData.lightTime = draggedItem.time;
			lightingChanged = true;
		// or if an equipped light is being unequipped (and not by a light)
		} else if (hand && sourceBoxIndex && (loadout1[hand] === updateData.equippedLight ||
			(draggedItem.twoHanded && loadout1[oppositeHand] === updateData.equippedLight)))
		{
			updateData.equippedLight = null;
			updateData.lightRange = 0;
			updateData.lightTime = 0;
			lightingChanged = true;
		}

		// if dragged item is two-handed
		if (hand && draggedItem.twoHanded) {
			if (loadout1.right && loadout1.left && loadout1.right !== loadout1.left && notEnoughSpaceInInventory(2, 1, this.props.selectedCharacterInfo)) {
				dialogProps = {
					dialogContent: `The ${draggedItem.name} is two-handed, and there is not enough space in the inventory for both currently equipped items.`,
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
			loadout1[hand] = draggedItem.id;
			loadout1[oppositeHand] = draggedItem.id;
		// or if we're replacing a two-handed item with a one-handed item
		} else if (hand && loadout1.right && loadout1.right === loadout1.left) {
			loadout1[hand] = draggedItem.id;
			loadout1[oppositeHand] = '';
		// or we're just equipping a one-handed item
		} else if (hand) {
			// if item is dragged from one hand to another, sourceBoxIndex is null
			if (!sourceBoxIndex) {
				loadout1[oppositeHand] = loadout1[hand];
			} else if (loadout1.left === lightBeingSwapped) {
				loadout1.left = '';
				hand = 'left';
			} else if (loadout1.right === lightBeingSwapped) {
				loadout1.right = '';
				hand = 'right';
			}
			loadout1[hand] = draggedItem.id;
		// or we're equipping a body item
		} else if (destination === 'body') {
			updateData.equippedItems.armor = draggedItem.id;
			updateData.defense = this.props.selectedCharacterInfo.calculateDefense();
			updateData.damageReduction = draggedItem.damageReduction;
		}

		// if item is dragged from one hand to another, sourceBoxIndex is null
		if (sourceBoxIndex) {
			tempAllItemsList.splice(+sourceBoxIndex[0], 1, null);
		}

		this.updateInventory(this.props.selectedCharacterInfo.id, tempAllItemsList, () => {
			this.props.updateCharacters('player', updateData, this.props.selectedCharacterInfo.id, lightingChanged, false, false);
		});
	}

	dropItemToInv = (evt) => {
		if (!this.state.objectSelected || Object.keys(this.state.objectSelected).length === 0) {
			return;
		}
		const draggedItem = this.state.objectSelected;
		const draggedObjectMetaData = this.state.draggedObjectMetaData;
		if (!draggedItem) return;
		if (notEnoughSpaceInInventory(1, 0, this.props.selectedCharacterInfo)) {
			this.props.setShowDialogProps(true, this.props.notEnoughSpaceDialogProps);
			return;
		}

		const updateData = deepCopy(this.props.selectedCharacterInfo);
		const equippedItems = updateData.equippedItems;
		const inventoryItems = this.state.entireInventory[this.props.selectedCharacterInfo.id];
		let lightingChanged = false;

		let draggingEquippedItem = false;
		if (equippedItems.armor === draggedItem.id) {
			updateData.equippedItems.armor = '';
			updateData.defense = this.props.selectedCharacterInfo.calculateDefense();
			updateData.damageReduction = 0;
			draggingEquippedItem = true;
		} else if (equippedItems.loadout1.left === draggedItem.id) {
			updateData.equippedItems.loadout1.left = '';
			draggingEquippedItem = true;
		}

		// this is not an else if because a two handed weapon would take up both left and right
		if (equippedItems.loadout1.right === draggedItem.id) {
			updateData.equippedItems.loadout1.right = '';
			draggingEquippedItem = true;
		}

		if (draggedItem.itemType && draggedItem.itemType === 'Light' && updateData.equippedLight === draggedItem.id) {
			updateData.equippedLight = null;
			updateData.lightRange = 0;
			draggingEquippedItem = true;
			lightingChanged = true;
		}

		if (draggingEquippedItem) {
			this.props.updateCharacters('player', updateData, this.props.selectedCharacterInfo.id, lightingChanged, false, false);
		} else {
			let tempAllItemsList = [...inventoryItems];
			const targetIsBox = evt.target.id.includes('invBox');
			const targetId = +evt.target.id.match(/\d+/)[0];
			const parentId = !targetIsBox ? +evt.target.parentElement.id.match(/\d+/)[0] : null;
			const destBoxIndex = targetIsBox ? targetId : parentId;
			const destBoxContents = tempAllItemsList[destBoxIndex];
			const sourceBoxIndex = +draggedObjectMetaData.sourceLoc.match(/\d+/)[0];

			// replace contents of destination spot with dragged item
			tempAllItemsList.splice(destBoxIndex, 1, draggedItem.id);
			// replace contents of source spot with replaced destination item
			tempAllItemsList.splice(sourceBoxIndex, 1, destBoxContents);
			this.updateInventory(this.props.selectedCharacterInfo.id, tempAllItemsList);
		}
	}

	addObjToOtherPc = (draggedItemCount, sourceItemCount) => {
		if (!this.state.objectSelected || Object.keys(this.state.objectSelected).length === 0) {
			return;
		}
		const draggedItem = this.state.objectSelected;
		const draggedObjectMetaData = this.state.draggedObjectMetaData;
		if (!draggedItem) return;

		const allPCdata = deepCopy(this.props.playerCharacters);
		const sourcePCdata = allPCdata[draggedObjectMetaData.sourcePC];
		const recipientId = this.state.draggedObjRecipient;
		const currentPCdata = allPCdata[recipientId];
		const allPlayersInv = deepCopy(this.state.entireInventory);
		const invObjectCategory = draggedItem.itemType ? 'items' : 'weapons';
		const invId = draggedItem.id;

		// for stackable items, need to update count from object panel split
		if (draggedItem.gunType || invObjectCategory === 'items') {
			draggedItem.amount = draggedItemCount;
		} else {
			draggedItem.currentRounds = draggedItemCount;
		}

		// gun ammo
		if (draggedItem.gunType) {
			if (!currentPCdata.items[invId]) {
				currentPCdata.items[invId] = {...draggedItem};
			} else {
				currentPCdata.items[invId].amount += draggedItem.amount;
			}
		} else {
			if (!currentPCdata[invObjectCategory][invId]) {
				currentPCdata[invObjectCategory][invId] = {...draggedItem};
			} else if (invObjectCategory === 'weapons'){
				currentPCdata.weapons[invId].currentRounds += draggedItem.currentRounds;
			} else {
				currentPCdata.items[invId].amount += draggedItem.amount;
			}
		}

		// now add item to inv shown in char info panel
		const firstOpenInvSlot = allPlayersInv[recipientId].indexOf(null);
		if (!allPlayersInv[recipientId].includes(invId) && currentPCdata.equippedItems.loadout1.right !== invId && currentPCdata.equippedItems.loadout1.left !== invId) {
			allPlayersInv[recipientId].splice(firstOpenInvSlot, 1, invId);
		}

		this.updateSourcePcInvAfterTransfer(invObjectCategory, sourceItemCount, sourcePCdata, allPlayersInv, false, () => {
			this.props.updateCharacters('player', currentPCdata, recipientId);
		});
	}

	/**
	 * adds object to map and removes from PC inv when an object is dropped
	 * @param draggedItemCount: number (comes from callback from ObjectInfoPanel - only used for stackable items)
	 * @param sourceItemCount: number (comes from callback from ObjectInfoPanel - only used for stackable items)
	 */
	addObjectToMap = (draggedItemCount, sourceItemCount) => {
		if (!this.state.objectSelected || Object.keys(this.state.objectSelected).length === 0) {
			return;
		}
		const sourcePcData = deepCopy(this.props.playerCharacters[this.state.draggedObjectMetaData.sourcePC]);
		const allPlayersInv = deepCopy(this.state.entireInventory);
		const invObjectCategory = this.state.objectSelected.itemType ? 'items' : 'weapons';
		const draggedObject = deepCopy(this.state.objectSelected);
		const lightingChanged = draggedObject.itemType && draggedObject.itemType === 'Light';

		// for stackable items, need to update count from object panel split
		if (draggedObject.amount) {
			draggedObject.amount = draggedItemCount;
		} else if (draggedObject.currentRounds) {
			draggedObject.currentRounds = draggedItemCount;
		}
		this.updateSourcePcInvAfterTransfer(invObjectCategory, sourceItemCount, sourcePcData, allPlayersInv, false, () => {
			const mapObjects = deepCopy(this.props.mapObjects);
			mapObjects[draggedObject.id] = {
				...draggedObject,
				coords: sourcePcData.coords
			}
			this.props.updateMapObjects(mapObjects, lightingChanged, () => this.props.setHasObjBeenDropped(false));
		});
	}

	/**
	 * Store whether an object in inv or on the map has been selected (if isMapObj is true, item was selected on map instead of inv)
	 * @param objectSelected: array or object or null (array only if object was clicked on in the map, object any other time, null if obj is deselected or obj panel closed;
	 *      object format: {...itemInfo, id: itemId})
	 * @param draggedObjectMetaData: object (source info for dragged item: sourcePC, sourceLoc, sourceClasses)
	 * @param isMapObj: boolean (indicates user clicked on a map object/stack of objects)
	 * @param isPickUpAction: boolean
	 * @param callback: function
	 */
	setObjectSelected = (objectSelected, draggedObjectMetaData, isMapObj, isPickUpAction, callback) => {
		const objectIsSelected = objectSelected !== null;
		this.setState({objectSelected, objectIsSelected, draggedObjectMetaData, isMapObj, isPickUpAction}, () => {
			if (callback) callback();
			// if object info panel is closed by clicking cancel/X button
			if (!objectIsSelected && this.props.objectSelected) {
				this.props.setMapObjectSelected(null);
			}
		});
	}

	/**
	 * Determines position for object info panel or contextual menu
	 * @param x
	 * @param y
	 * @param panelType: string ('object' or 'menu')
	 * @returns {{top: *, left: *}}
	 */
	calculatePanelCoords(x, y, panelType) {
		let coords = {};
		const panelWidth = panelType === 'object' ? this.props.objectPanelWidth : this.props.contextMenuWidth;
		const panelHeight = panelType === 'object' ? this.props.objectPanelHeight : this.props.contextMenuHeight;

		// use this version for object panels on mobile
		if (panelType === 'object' && (this.props.screenData.isNarrow || this.props.screenData.isShort)) {
			const left = this.props.screenData.isNarrow ? 0 : (window.innerWidth - panelWidth) / 2;
			coords = {left, top: (window.innerHeight - panelHeight) / 2};
		// use this version for full screen or mobile context menu
		} else {
			const xBuffer = 30;
			const yBuffer = 80;
			const leftMod = x > (window.innerWidth - panelWidth) ? -(panelWidth + xBuffer) : 0;
			const halfScreenHeight = this.props.screenData.height / 2;
			const controlBarTopPos = this.props.screenData.height - this.props.uiControlBarHeight;
			// if context menu or clicked item is top half of screen, position at cursor;
			// or if clicking pick up action button, push up 3x buffer;
			// otherwise, clicked lower half of screen, push up 1x buffer
			const topMod = (panelType === 'menu') || (y < halfScreenHeight) ? 0 : y > controlBarTopPos ? -(yBuffer * 3) : -yBuffer;
			coords = {left: x + leftMod, top: y + topMod};
		}
		return coords;
	}

	/**
	 * Sets whether to show object info panel
	 * @param needToShowObjectPanel: boolean (false when closing panel)
	 * @param evt: event object
	 * @param draggedObjRecipient: string (ID - used for addObjToOtherPc)
	 * @param callback: function (mainly for opening new panel after closing current one)
	 */
	setObjectPanelDisplayOption = (needToShowObjectPanel, evt, draggedObjRecipient, callback) => {
		const selectedObjPos = evt ? this.calculatePanelCoords(evt.clientX, evt.clientY, 'object') : null;
		this.setState({needToShowObjectPanel, selectedObjPos, draggedObjRecipient}, () => {
			if (callback) callback();
		});
	}

	showObjectPanel = () => {
		let dialogProps = null;
		if ((this.props.playerLimits.actions - this.props.actionsCompleted.actions) === 0) {
			dialogProps = this.props.noMoreActionsDialogProps;
		} else if (notEnoughSpaceInInventory(1, 0, this.props.playerCharacters[this.props.activeCharacter])) {
			dialogProps = this.props.notEnoughSpaceDialogProps;
		}
		const creatureCoords = this.props.getAllCharactersPos('creature', 'coords');
		return (
			<ObjectInfoPanel
				objectInfo={this.state.objectSelected}
				isDraggedObject={this.state.draggedObjectMetaData !== null}
				setObjectSelected={this.setObjectSelected}
				setObjectPanelDisplayOption={this.setObjectPanelDisplayOption}
				selectedObjPos={this.state.selectedObjPos}
				objHasBeenDropped={this.props.objHasBeenDropped}
				setHasObjBeenDropped={this.props.setHasObjBeenDropped}
				dropItemToPC={this.dropItemToPC}
				dropItemToEquipped={this.dropItemToEquipped}
				dropItemToInv={this.dropItemToInv}
				addObjectToMap={this.addObjectToMap}
				addObjToOtherPc={this.addObjToOtherPc}
				addItemToPlayerInventory={this.props.addItemToPlayerInventory}
				isPickUpAction={this.state.isPickUpAction}
				isMapObj={this.state.isMapObj}
				dialogProps={dialogProps}
				setShowDialogProps={this.props.setShowDialogProps}
				creatureCoords={creatureCoords}
			/>
		)
	}

	switchEquipment = (id) => {
		const updateData = deepCopy(this.props.playerCharacters[id]);
		const loadout2 = updateData.equippedItems.loadout2;
		const leftHandHasLight = updateData.items[loadout2.left] && updateData.items[loadout2.left].itemType === 'Light';
		const rightHandHasLight = updateData.items[loadout2.right] && updateData.items[loadout2.right].itemType === 'Light';
		let tempAllItemsList = [...this.state.entireInventory[id]];
		let lightingChanged = false;

		if (updateData.equippedLight || leftHandHasLight || rightHandHasLight) {
			updateData.equippedLight = leftHandHasLight ? loadout2.left : rightHandHasLight ? loadout2.right : null;
			updateData.lightRange = updateData.equippedLight ? updateData.items[updateData.equippedLight].range : 0;
			lightingChanged = true;
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
			this.props.updateCharacters('player', updatedData, id, lightingChanged, false, false);
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
	 * Update UI's list of inv items in state
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
			if (callback) {
				callback();
			}
		});
	}

	toggleMusic = () => {
		const music = this.audioSelectors.music[this.props.gameOptions.songName];
		if (this.props.gameOptions.playMusic) {
			music.volume = this.props.gameOptions.musicVolume;
			music.play().catch(e => console.log(e));
		} else {
			music.pause();
		}
	}

	adjustMusicComponentVolume = (value) => {
		this.audioSelectors.music[this.props.gameOptions.songName].volume = value;
	}

	/**
	 * Sets up selectors for music elements
	 * @private
	 */
	_populateSfxSelectors() {
		this.audioSelectors.music[this.props.gameOptions.songName] = document.getElementById(`music-${this.props.gameOptions.songName}-theme`);
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

	toggleOptionsPanel = () => {
		this.setState(prevState => ({showGameOptions: !prevState.showGameOptions}));
	}

	toggleHelpScreen = () => {
		this.setState(prevState => ({showHelpScreen: !prevState.showHelpScreen}));
	}

	/**
	 *
	 * @param clickedObjPos
	 */
	processTileClick = (clickedObjPos) => {
		// if object was clicked on on the map, check if any other objects are on the same tile
		let clickedObjects = [];
		if (!this.props.objectSelected.isPickUpAction) {
			for (const [objId, objInfo] of Object.entries(this.props.mapObjects)) {
				const objPos = convertCoordsToPos(objInfo.coords);
				if (clickedObjPos === objPos) {
					clickedObjects.push({...objInfo, id: objId});
				}
			}
		} else {
			//todo: not sure deepcopy is needed, as currently nothing is modifying this.state.selectedObject outside of setObjectSelected for clicked objects
			clickedObjects = deepCopy(this.props.objectSelected.objectList);
		}
		this.setObjectPanelDisplayOption(false, null, null, () => {
			this.setObjectSelected(clickedObjects, null, true, this.props.objectSelected.isPickUpAction, () => {
				this.setObjectPanelDisplayOption(true, this.props.objectSelected.evt, null);
			});
		});
	}

	componentDidMount() {
		if (Object.keys(this.state.entireInventory).length === 0) {
			for (const id of Object.keys(this.props.playerCharacters)) {
				this._parseInvItems(id, []);
			}
		}
		if (this.initialUiLoad) {
			this._populateSfxSelectors();
			this.toggleMusic();
			this.initialUiLoad = false;
			this.setSelectedControlTab(this.props.activeCharacter);
		}
	}

	componentDidUpdate(prevProps, prevState, snapShot) {
		if (prevProps.logText !== this.props.logText) {
			this.setState({logText: [...this.props.logText]}, this.scrollLog);
		}

		if (this.props.selectedCharacterInfo && prevProps.selectedCharacterInfo !== this.props.selectedCharacterInfo) {
			this._parseInvItems(this.props.selectedCharacterInfo.id, this.state.entireInventory[this.props.selectedCharacterInfo.id]);
		}

		if (prevProps.activeCharacter !== this.props.activeCharacter && this.props.playerCharacters[this.props.activeCharacter]) {
			this.setSelectedControlTab(this.props.activeCharacter);
		}

		const clickedObjPos = this.props.objectSelected ? convertCoordsToPos(this.props.objectSelected.objectList[0].coords) : null;
		// if no object selected before or different object selected than before (for handling object clicked/selected on map)
		if (this.props.objectSelected && (!prevProps.objectSelected || clickedObjPos !== convertCoordsToPos(prevProps.objectSelected.objectList[0].coords))) {
			this.processTileClick(clickedObjPos);
		}

		// for handling dropping object from inv to map
		if (!prevProps.objHasBeenDropped.dropped && this.props.objHasBeenDropped.dropped) {
			if (this.state.objectSelected && this.state.objectSelected.stackable) {
				this.setObjectPanelDisplayOption(true, this.props.objHasBeenDropped.evt, null);
			} else {
				// don't need to pass in dropped and source counts, as it's not a stackable object
				this.addObjectToMap();
			}
		}

		if (prevProps.gameOptions.playMusic !== this.props.gameOptions.playMusic) {
			this.toggleMusic();
		}
	}

	render() {
		return (
			<div className='ui-container'>
				{this.props.showDialog && this.props.dialogProps && <this.showDialog />}

				{this.state.needToShowObjectPanel && <this.showObjectPanel />}

				{this.props.contextMenu &&
				<ContextMenu
					actionsAvailable={this.props.contextMenu.actionsAvailable}
					creatureId={this.props.contextMenu.creatureId}
					processTileClick={this.processTileClick}
					handleUnitClick={this.props.handleUnitClick}
					setUserInteraction={this.props.setUserInteraction}
					setUserMove={this.props.setUserMove}
					handleContextMenuSelection={this.props.handleContextMenuSelection}
					menuPosStyle={this.calculatePanelCoords(this.props.contextMenu.evt.clientX, this.props.contextMenu.evt.clientY, 'menu')}
					buttonStyle={{width: '32px', height: '32px', backgroundPosition: 'center'}}
				/>}

				<div ref={this.uiRefs.turnInfo} className='turn-info-container ui-panel'>
					<div ref={this.uiRefs.log} className='log-container'>
						{this.state.logText &&
						<div className='log-lines'>
							<this.addLogLines />
						</div>
						}
					</div>

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
						updateFollowModePositions={this.props.updateFollowModePositions}
						endTurnCallback={this.props.updateCurrentTurn}
						toggleActionButton={this.props.toggleActionButton}
						updateUnitSelectionStatus={this.props.updateUnitSelectionStatus}
						characterIsSelected={this.props.characterIsSelected}
						characterInfo={this.props.selectedCharacterInfo}
						creatureIsSelected={this.props.creatureIsSelected}
						creatureInfo={this.props.selectedCreatureInfo}
					/>}
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
					setObjectPanelDisplayOption={this.setObjectPanelDisplayOption}
					dropItemToInv={this.dropItemToInv}
					dropItemToEquipped={this.dropItemToEquipped}
					notEnoughSpaceDialogProps={this.props.notEnoughSpaceDialogProps}
				/>}

				{this.props.selectedCreatureInfo &&
				<CreatureInfoPanel
					creatureIsSelected={this.props.creatureIsSelected}
					updateUnitSelectionStatus={this.props.updateUnitSelectionStatus}
					creatureInfo={this.props.selectedCreatureInfo}
				/>}

				<div id='system-buttons-container'>
					<div className='system-button help-button font-fancy' onClick={() => this.toggleHelpScreen()}>?</div>
					<div id='screen-zoom-container'>
						<div className='screen-zoom-icon'>+</div>
						<input id='screen-zoom-slider' type='range' min='0.5' max='1.5' step='0.1' value={this.props.gameOptions.screenZoom} onInput={evt => {
							const gameOptions = {...this.props.gameOptions};
							gameOptions.screenZoom = +evt.target.value;
							this.props.updateGameOptions(gameOptions);
						}} />
						<div className='screen-zoom-icon'>&ndash;</div>
					</div>
					<div className='system-button center-on-player-button' onClick={() => this.props.toggleCenterOnPlayer()}></div>
					<div className='system-button game-options-button' onClick={() => this.toggleOptionsPanel()}></div>
				</div>

				<div id='control-bar-container' ref={this.uiRefs.controlBar} className='ui-panel'>
					{/*<div className='minimize-button general-button' onClick={() => {*/}
					{/*	this.minimizePanel('controlBar');*/}
					{/*}}>_</div>*/}
					{this.props.playerCharacters && <this.showControlBar />}
				</div>

				<HelpScreen
					showHelpScreen={this.state.showHelpScreen}
					toggleHelpScreen={this.toggleHelpScreen}
					screenData={this.props.screenData}
				/>

				<GameOptions
					gameOptions={this.props.gameOptions}
					toggleOptionsPanel={this.toggleOptionsPanel}
					showGameOptions={this.state.showGameOptions}
					updateGameOptions={this.props.updateGameOptions}
					adjustMusicComponentVolume={this.adjustMusicComponentVolume}
					screenData={this.props.screenData}
				/>
			</div>
		);
	}
}

export default UI;
