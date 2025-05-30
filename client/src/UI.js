import React from 'react';
import {
	CharacterControls,
	CharacterInfoPanel,
	CreatureInfoPanel,
	ObjectInfoPanel,
	ModeInfoPanel,
	PartyInfoPanel,
	JournalWindow,
	ConversationWindow,
	DialogWindow,
	ContextMenu,
	HelpPopup,
	GameOptions
} from './UIElements';
import PopupHelp from './data/popupHelp.json';
import {Music} from './Audio';
import {convertCoordsToPos, notEnoughSpaceInInventory, deepCopy} from './Utils';
import './css/ui.css';

class UI extends React.PureComponent {
	constructor(props) {
		super(props);

		this.initialUiLoad = true;

		this.uiRefs = {
			controlBar: React.createRef(),
			turnInfo: React.createRef(),
			log: React.createRef()
		};
		this.audioSelectors = {
			music: {
				catacombs: {},
				museum: {}
			}
		};

		this.state = {
			showGameOptions: false,
			showHelpSystem: false,
			showHelpPopup: null,
			showJournal: false,
			showConversation: false,
			logText: this.props.logText,
			controlBarMinimized: false,
			selectedControlTab: '',
			logMinimized: false,
			modeMinimized: false,
			inventoryData: {},
			objectIsSelected: false,
			selectedObjPos: {},
			objectSelected: {},
			draggedObjectMetaData: {},
			draggedObjRecipient: '',
			needToShowObjectPanel: false,
			isPickUpAction: false,
			controlBarColumnCount: `control-bar-${Object.keys(this.props.playerCharacters).length}-columns`
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

	setShowJournal = () => {
		this.setState(prevState => ({
			showJournal: !prevState.showJournal
		}));
	}

	setShowConversation = (callback) => {
		this.setState(prevState => ({
			showConversation: !prevState.showConversation
		}), callback);
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

		this.props.pcObjectOrdering.forEach(id => {
			const playerInfo = this.props.playerCharacters[id];
			if (playerInfo) {
				// for setting up Pickup action and Open container/mineable action buttons
				let mapObjectsOnPcTiles = [];
				let containersNextToPc = [];
				let mineablesNextToPc = [];
				let trapsNextToPc = [];
				const hasEnoughLight = (id === 'archaeologist' && playerInfo.lightTime >= this.props.lightTimeCosts.expertMining) ||
					playerInfo.lightTime >= this.props.lightTimeCosts.mine;
				const allObjects = {...this.props.mapObjects, ...this.props.envObjects};
				for (const [objId, objInfo] of Object.entries(allObjects)) {
					const xDelta = Math.abs(playerInfo.coords.xPos - objInfo.coords.xPos);
					const yDelta = Math.abs(playerInfo.coords.yPos - objInfo.coords.yPos);
					const objInfoAndId = {...objInfo, id: objId};
					if (xDelta <= 1 && yDelta <= 1) {
						if (objInfo.isEnvObject && objInfo.type === 'container' && (!objInfo.isOpen || objInfo.containerContents.length > 0)) {
							containersNextToPc.push(objInfoAndId);
						} else if (objInfo.isEnvObject && objInfo.type === 'mineable' && (!objInfo.isDestroyed || objInfo.containerContents.length > 0)) {
							mineablesNextToPc.push(objInfoAndId);
						} else if (objInfo.isEnvObject && objInfo.type === 'trap' && objInfo.isDiscovered && !objInfo.isDestroyed && !objInfo.isSprung) {
							trapsNextToPc.push(objInfoAndId);
						} else if (!objInfo.isEnvObject) {
							mapObjectsOnPcTiles.push(objInfoAndId);
						}
					}
				}

				controlPanels.push(
					<CharacterControls
						key={id}
						playerCharacters={this.props.playerCharacters}
						characterId={id}
						characterName={`${playerInfo.name.first} ${playerInfo.name.last}`}
						equippedItems={playerInfo.equippedItems}
						invItems={playerInfo.items}
						toggleActionButton={this.props.toggleActionButton}
						actionButtonSelected={this.props.actionButtonSelected}
						skillModeActive={this.props.skillModeActive}
						isActiveCharacter={id === this.props.activeCharacter}
						movesRemaining={this.props.playerLimits.moves - this.props.actionsCompleted.moves}
						actionsRemaining={this.props.playerLimits.actions - this.props.actionsCompleted.actions}
						inTacticalMode={this.props.inTacticalMode}
						threatList={this.props.threatList}
						updateCharacters={this.props.updateCharacters}
						checkForExtraAmmo={this.checkForExtraAmmo}
						reloadGun={this.props.reloadGun}
						refillLight={this.props.refillLight}
						hasEnoughLight={hasEnoughLight}
						notEnoughLightDialogProps={this.props.notEnoughLightDialogProps}
						showDialog={this.props.showDialog}
						setShowDialogProps={this.props.setShowDialogProps}
						dropItemToPC={this.dropItemToPC}
						setMapObjectSelected={this.props.setMapObjectSelected}
						mapObjectsOnPcTiles={mapObjectsOnPcTiles}
						containersNextToPc={containersNextToPc}
						mineablesNextToPc={mineablesNextToPc}
						trapsNextToPc={trapsNextToPc}
						screenData={this.props.screenData}
						selectedControlTab={this.state.selectedControlTab}
						setSelectedControlTab={this.setSelectedControlTab}
						helpPopupButton={this.helpPopupButton}
						showHelpSystem={this.state.showHelpSystem}
						toggleHelpPopup={this.toggleHelpPopup}
					/>
				)
			}
		});
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
	 * note: sourcePCdata that's passed in and gets updated directly is deepCopy of data sent from calling functions
	 * @param invObjectCategory: string
	 * @param sourceItemCount: number
	 * @param sourcePCdata: object
	 * @param lightingChanged: boolean
	 * @param callback: function
	 */
	updateSourcePcInvAfterTransfer = (invObjectCategory, sourceItemCount, sourcePCdata, lightingChanged, callback = null) => {
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
				sourcePCdata.inventory.splice(+sourceBoxIndex[0], 1, null);
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
				sourcePCdata.lightTime = 0;
			}
		// otherwise just update its item count
		} else if (sourceItemCount > 0) {
			if (draggedItem.gunType || invObjectCategory === 'items') {
				sourcePCdata[invObjectCategory][invId].amount = sourceItemCount;
			} else {
				sourcePCdata[invObjectCategory][invId].currentRounds = sourceItemCount;
			}
		}

		this.props.updateCharacters('player', sourcePCdata, draggedObjectMetaData.sourcePC, lightingChanged, false, false, callback);
	}

	/**
	 * For moving an item from one PC to another
	 * @param evt
	 * @param recipientId: string
	 */
	dropItemToPC = (evt, recipientId) => {
		if (!this.state.objectIsSelected) return; //prevent dragging of non-item (like follow ordering icon) to pc
		const draggedItem = this.state.objectSelected;
		const draggedObjectMetaData = this.state.draggedObjectMetaData;
		const allPCdata = deepCopy(this.props.playerCharacters);
		const sourcePCdata = allPCdata[draggedObjectMetaData.sourcePC];
		const currentPCdata = allPCdata[recipientId];
		if (!draggedItem || draggedObjectMetaData.sourcePC === recipientId) {
			return;
		}
		let dialogProps = null;

		// If destination pc is too far away
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
		// or if not enough space in destination inv
		} else if (notEnoughSpaceInInventory(1, 0, currentPCdata)) {
			dialogProps = this.props.notEnoughSpaceDialogProps;
		// if item dragged is stackable, open options dialog
		} else if (draggedItem.stackable) {
			this.setObjectPanelDisplayOption(true, evt, recipientId);
		// add dragged item to destination pc inv
		} else {
			const invObjectCategory = draggedItem.itemType ? 'items' : 'weapons';
			const invId = draggedItem.id;
			const lightingChanged = draggedItem.itemType && draggedItem.itemType === 'Light' && sourcePCdata.equippedLight === invId;

			this.updateSourcePcInvAfterTransfer(invObjectCategory, null, sourcePCdata, lightingChanged, () => {
				this.props.addItemToPlayerInventory(draggedItem, invId, recipientId, false, false);
			});
		}
		this.resetObjectIsSelected();
		if (dialogProps) {
			this.props.setShowDialogProps(true, dialogProps);
		}
	}

	/**
	 * For moving item from unequipped to equipped or from one hand to the other
	 * Also takes care of item swapping
	 * @param evt
	 */
	dropItemToEquipped = (evt) => {
		if (!this.state.objectIsSelected || !this.state.objectSelected || Object.keys(this.state.objectSelected).length === 0) {
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
		let updateData = deepCopy(this.props.selectedCharacterInfo);
		const sourceBoxIndex = draggedObjectMetaData.sourceLoc.match(/\d+/);
		const loadout1 = updateData.equippedItems.loadout1;
		let lightBeingSwapped = null;
		let itemBeingReplaced = '';
		let secondItemBeingReplaced = '';
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
			}
			if (updateData.id === 'thief' && updateData.statuses.stealthy) {
				delete updateData.statuses.stealthy;
				this.props.updateLog(`After equipping a light source, ${updateData.name.first} is no longer hiding in the shadows`);
			}
			itemBeingReplaced = updateData.equippedLight;
			updateData.equippedLight = draggedItem.id;
			updateData.lightRange = draggedItem.range;
			updateData.lightTime = draggedItem.time;
			lightingChanged = true;
		// or if an equipped light is being unequipped (and not by a light)
		} else if (hand && sourceBoxIndex && (loadout1[hand] === updateData.equippedLight ||
			(draggedItem.twoHanded && loadout1[oppositeHand] === updateData.equippedLight)))
		{
			itemBeingReplaced = updateData.equippedLight;
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
			itemBeingReplaced = loadout1[hand];
			secondItemBeingReplaced = loadout1[oppositeHand];
			loadout1[hand] = draggedItem.id;
			loadout1[oppositeHand] = draggedItem.id;
		// or if we're replacing a two-handed item with a one-handed item
		} else if (hand && loadout1.right && loadout1.right === loadout1.left) {
			itemBeingReplaced = loadout1[hand];
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
			itemBeingReplaced = lightBeingSwapped || loadout1[hand];
			loadout1[hand] = draggedItem.id;
		// or we're equipping a body item
		} else if (destination === 'body') {
			itemBeingReplaced = updateData.equippedItems.armor;
			updateData.equippedItems.armor = draggedItem.id;
			updateData.defense = this.props.selectedCharacterInfo.calculateDefense(this.props.selectedCharacterInfo.agility, this.props.selectedCharacterInfo.items[updateData.equippedItems.armor].defense);
			updateData.damageReduction = draggedItem.damageReduction;
		}

		// Update inventory array, though if item is dragged from one hand to another, sourceBoxIndex is null, so no update needed
		if (sourceBoxIndex) {
			updateData.inventory.splice(+sourceBoxIndex[0], 1, null);
			if (itemBeingReplaced) {
				const firstOpenInvSlot = updateData.inventory.indexOf(null);
				updateData.inventory.splice(firstOpenInvSlot, 1, itemBeingReplaced);
			}
			if (secondItemBeingReplaced) {
				const firstOpenInvSlot = updateData.inventory.indexOf(null);
				updateData.inventory.splice(firstOpenInvSlot, 1, secondItemBeingReplaced);
			}
		}

		this.props.updateCharacters('player', updateData, this.props.selectedCharacterInfo.id, lightingChanged, false, false, () => {
			this.resetObjectIsSelected();
		});
	}

	/**
	 * For moving item from equipped to unequipped or from one inv spot to another
	 * Also takes care of item swapping
	 * @param evt
	 */
	dropItemToInv = (evt) => {
		if (!this.state.objectIsSelected || !this.state.objectSelected || Object.keys(this.state.objectSelected).length === 0) {
			return;
		}
		const draggedItem = this.state.objectSelected;
		const draggedObjectMetaData = this.state.draggedObjectMetaData;
		if (!draggedItem) return;
		if (notEnoughSpaceInInventory(1, 0, this.props.selectedCharacterInfo)) {
			this.props.setShowDialogProps(true, this.props.notEnoughSpaceDialogProps);
			return;
		}

		let updateData = deepCopy(this.props.selectedCharacterInfo);
		const equippedItems = updateData.equippedItems;
		let lightingChanged = false;

		let draggingEquippedItem = false;
		if (equippedItems.armor === draggedItem.id) {
			updateData.equippedItems.armor = '';
			updateData.defense = this.props.selectedCharacterInfo.calculateDefense(this.props.selectedCharacterInfo.agility, 0);
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
			updateData.lightTime = 0;
			draggingEquippedItem = true;
			lightingChanged = true;
		}

		if (draggingEquippedItem) {
			const firstOpenInvSlot = updateData.inventory.indexOf(null);
			updateData.inventory.splice(firstOpenInvSlot, 1, draggedItem.id);
		} else {
			const targetIsBox = evt.target.id.includes('invBox');
			const targetId = +evt.target.id.match(/\d+/)[0];
			const parentId = !targetIsBox ? +evt.target.parentElement.id.match(/\d+/)[0] : null;
			const destBoxIndex = targetIsBox ? targetId : parentId;
			const destBoxContents = updateData.inventory[destBoxIndex];
			const sourceBoxIndex = +draggedObjectMetaData.sourceLoc.match(/\d+/)[0];

			// replace contents of destination spot with dragged item
			updateData.inventory.splice(destBoxIndex, 1, draggedItem.id);
			// replace contents of source spot with replaced destination item
			updateData.inventory.splice(sourceBoxIndex, 1, destBoxContents);
		}
		this.props.updateCharacters('player', updateData, this.props.selectedCharacterInfo.id, lightingChanged, false, false, () => {
			this.resetObjectIsSelected();
		});
	}

	/**
	 * For moving a stackable item from one PC to another (called by object info panel)
	 * @param draggedItemCount: integer
	 * @param sourceItemCount: integer
	 */
	addStackedObjToOtherPc = (draggedItemCount, sourceItemCount) => {
		if (!this.state.objectSelected || Object.keys(this.state.objectSelected).length === 0) {
			return;
		}
		const draggedItem = this.state.objectSelected;
		const draggedObjectMetaData = this.state.draggedObjectMetaData;
		if (!draggedItem) return;

		const allPCdata = deepCopy(this.props.playerCharacters);
		let sourcePCdata = allPCdata[draggedObjectMetaData.sourcePC];
		const recipientId = this.state.draggedObjRecipient;
		let currentPCdata = allPCdata[recipientId];
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
		const firstOpenInvSlot = currentPCdata.inventory.indexOf(null);
		if (!currentPCdata.inventory.includes(invId) && currentPCdata.equippedItems.loadout1.right !== invId && currentPCdata.equippedItems.loadout1.left !== invId) {
			currentPCdata.inventory.splice(firstOpenInvSlot, 1, invId);
		}

		this.updateSourcePcInvAfterTransfer(invObjectCategory, sourceItemCount, sourcePCdata, false, () => {
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
		const invObjectCategory = this.state.objectSelected.itemType ? 'items' : 'weapons';
		const draggedObject = deepCopy(this.state.objectSelected);
		const lightingChanged = draggedObject.itemType && draggedObject.itemType === 'Light' && draggedObject.time > 0;

		// for stackable items, need to update count from object panel split
		if (draggedObject.amount) {
			draggedObject.amount = draggedItemCount;
		} else if (draggedObject.currentRounds) {
			draggedObject.currentRounds = draggedItemCount;
		}
		this.resetObjectIsSelected();
		this.updateSourcePcInvAfterTransfer(invObjectCategory, sourceItemCount, sourcePcData, false, () => {
			const mapObjects = deepCopy(this.props.mapObjects);
			const draggedObjGenericId = draggedObject.id.match(/\D+/)[0];
			let highestIdNum = 0;
			for (const id of Object.keys(mapObjects)) {
				if (id.includes(draggedObjGenericId)) {
					const idNum = +id.match(/\d+/)[0];
					highestIdNum = idNum > highestIdNum ? idNum : highestIdNum;
				}
			}
			const newMapObjId = draggedObjGenericId + (highestIdNum + 1);
			delete draggedObject.id;
			mapObjects[newMapObjId] = {
				...draggedObject,
				coords: sourcePcData.coords
			}
			this.props.updateMapObjects(mapObjects, lightingChanged, () => this.props.setHasObjBeenDropped({objHasBeenDropped: false, evt: null}));
		});
	}

	resetObjectIsSelected = () => {
		this.setState({objectIsSelected: false});
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
	 * For containers (sarcophagi, rubble mounds, etc.), calls App function updateMapEnvObjects to set them to open (user interacted with them)
	 * @param envObjectId: string
	 */
	setContainerOpenState = (envObjectId) => {
		let envObjects = deepCopy(this.props.envObjects);
		const activeEnvObj = envObjects[envObjectId];
		let changeMade = false;
		if (activeEnvObj.type === 'container') {
			activeEnvObj.isOpen = true;
			changeMade = true;
		} else if (activeEnvObj.type === 'mineable' && !activeEnvObj.isDestroyed) {
			if (activeEnvObj.isDestructible) {
				activeEnvObj.isDestroyed = true;
				changeMade = true;
			}
			this.props.updateLog(`${this.props.playerCharacters[this.props.activeCharacter].name.first} spends time digging through the rocks and dirt...`);
		}
		if (changeMade) {
			this.props.updateMapEnvObjects(envObjects, envObjectId);
		}
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
			const controlBarTopPos = this.props.screenData.height - this.props.uiControlBarHeight - yBuffer;
			let topMod = 0;
			// if context menu and clicked at bottom of screen (below where top of control bar is), bump up a little
			if (panelType === 'menu' && y > controlBarTopPos) {
				topMod = -yBuffer;
			// else if object panel and clicked at lower half of screen, bump up a lot if below top of control bar height or a little if above control bar
			} else if (panelType === 'object' && y > halfScreenHeight) {
				topMod = y > controlBarTopPos ? -(yBuffer * 4) : -yBuffer;
			}
			coords = {left: x + leftMod, top: y + topMod};
		}
		return coords;
	}

	/**
	 * Sets whether to show object info panel
	 * @param needToShowObjectPanel: boolean (false when closing panel)
	 * @param evt: event object
	 * @param draggedObjRecipient: string (ID - used for addStackedObjToOtherPc)
	 * @param callback: function (mainly for opening new panel after closing current one)
	 */
	setObjectPanelDisplayOption = (needToShowObjectPanel, evt, draggedObjRecipient, callback) => {
		const selectedObjPos = evt ? this.calculatePanelCoords(evt.clientX, evt.clientY, 'object') : null;
		this.setState({needToShowObjectPanel, selectedObjPos, draggedObjRecipient}, () => {
			if (callback) callback();
		});
	}

	showObjectPanel = () => {
		const creatureCoords = this.props.getAllCharactersPos('creature', 'coords');
		return (
			<ObjectInfoPanel
				objectInfo={this.state.objectSelected}
				isDraggedObject={this.state.draggedObjectMetaData !== null}
				setObjectSelected={this.setObjectSelected}
				setObjectPanelDisplayOption={this.setObjectPanelDisplayOption}
				selectedObjPos={this.state.selectedObjPos}
				objHasBeenDropped={this.props.objHasBeenDropped.dropped}
				setHasObjBeenDropped={this.props.setHasObjBeenDropped}
				addObjectToMap={this.addObjectToMap}
				addStackedObjToOtherPc={this.addStackedObjToOtherPc}
				addItemToPlayerInventory={this.props.addItemToPlayerInventory}
				isPickUpAction={this.state.isPickUpAction}
				isMapObj={this.state.isMapObj}
				notEnoughSpaceDialogProps={this.props.notEnoughSpaceDialogProps}
				setShowDialogProps={this.props.setShowDialogProps}
				creatureCoords={creatureCoords}
				activePc={this.props.activeCharacter}
				activePcInfo={this.props.playerCharacters[this.props.activeCharacter]}
				inTacticalMode={this.props.inTacticalMode}
				setContainerOpenState={this.setContainerOpenState}
			/>
		);
	}

	switchEquipment = (id) => {
		const updateData = deepCopy(this.props.playerCharacters[id]);
		const loadout2 = updateData.equippedItems.loadout2;
		const leftHandHasLight = updateData.items[loadout2.left] && updateData.items[loadout2.left].itemType === 'Light';
		const rightHandHasLight = updateData.items[loadout2.right] && updateData.items[loadout2.right].itemType === 'Light';
		let lightingChanged = false;

		if (updateData.equippedLight || leftHandHasLight || rightHandHasLight) {
			updateData.equippedLight = leftHandHasLight ? loadout2.left : rightHandHasLight ? loadout2.right : null;
			updateData.lightRange = updateData.equippedLight ? updateData.items[updateData.equippedLight].range : 0;
			lightingChanged = true;
		}
		updateData.equippedItems.loadout2 = {...updateData.equippedItems.loadout1};
		updateData.equippedItems.loadout1 = {...loadout2};

		for (const itemId of Object.values(updateData.equippedItems.loadout1)) {
			const itemBox = updateData.inventory.indexOf(itemId);
			updateData.inventory.splice(itemBox, 1, null);
		}
		for (const itemId of Object.values(updateData.equippedItems.loadout2)) {
			if (!updateData.inventory.includes(itemId) && updateData.equippedItems.loadout1.left !== itemId && updateData.equippedItems.loadout1.right !== itemId) {
				const itemBox = updateData.inventory.indexOf(null);
				updateData.inventory.splice(itemBox, 1, itemId);
			}
		}
		const updatedEquipmentData = {
			equippedItems: updateData.equippedItems,
			equippedLight: updateData.equippedLight,
			lightRange: updateData.lightRange,
			inventory: updateData.inventory
		};
		this.props.updateCharacters('player', updatedEquipmentData, id, lightingChanged, false, false);
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

	toggleMusic = () => {
		const music = this.audioSelectors.music[this.props.gameOptions.songName];
		if (this.props.gameOptions.playMusic) {
			music.volume = this.props.gameOptions.musicVolume;
			music.play().catch(e => console.log(e));
		} else if (music) {
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

	toggleOptionsPanel = () => {
		this.setState(prevState => ({showGameOptions: !prevState.showGameOptions}));
	}

	toggleHelpSystem = () => {
		this.setState(prevState => ({showHelpSystem: !prevState.showHelpSystem}));
	}

	/**
	 * UI elements call this when user clicks on them to show popup help
	 * @param evt object (for getting position of click/tap)
	 * @param helpContent object ({iconClass: [string], name: [string], description: [string]}) or null (to close popup)
	 */
	toggleHelpPopup = (evt, helpContent) => {
		const selectedIconPos = evt ? this.calculatePanelCoords(evt.clientX, evt.clientY, 'object') : null;
		const showHelpPopup = helpContent && (!this.state.showHelpPopup || helpContent.description !== this.state.showHelpPopup.description) ? {selectedIconPos, ...helpContent} : null;
		this.setState({showHelpPopup});
	}

	helpPopupButton = (content, style) => {
		const helpContent = PopupHelp[content] || content;
		return (
			<div className='system-button help-button popup-help-icon font-fancy' style={style} onClick={evt => {
				this.toggleHelpPopup(evt, helpContent);
			}}>?</div>
		)
	}

	updateControlBarColumnCount = (playerCount) => {
		const controlBarColumnCount = `control-bar-${playerCount}-columns`;
		this.setState({controlBarColumnCount});
	}

	/**
	 * When user clicks on tile with object(s) on it or pickup action button, gathers list of objects, then calls functions to
	 * set object info panel to closed (in case it was open for another tile), store the objects that are selected, and then open object info panel
	 * @param clickedObjPos: string
	 */
	processTileClick = (clickedObjPos) => {
		// if object was clicked on on the map, check if any other objects are on the same tile
		let clickedObjects = [];
		const allObjects = {...this.props.mapObjects, ...this.props.envObjects};
		if (!this.props.objectSelected.isPickUpAction) {
			for (const [objId, objInfo] of Object.entries(allObjects)) {
				const objPos = convertCoordsToPos(objInfo.coords);
				if (clickedObjPos === objPos) {
					clickedObjects.push({...objInfo, id: objId});
				}
			}
		} else {
			//TODO: not sure deepcopy is needed, as currently nothing is modifying this.state.selectedObject outside of setObjectSelected for clicked objects
			clickedObjects = deepCopy(this.props.objectSelected.objectList);
		}
		this.setObjectPanelDisplayOption(false, null, null, () => {
			this.setObjectSelected(clickedObjects, null, true, this.props.objectSelected.isPickUpAction, () => {
				this.setObjectPanelDisplayOption(true, this.props.objectSelected.evt, null);
			});
		});
	}

	componentDidMount() {
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

		if (prevProps.activeCharacter !== this.props.activeCharacter && this.props.playerCharacters[this.props.activeCharacter]) {
			this.setSelectedControlTab(this.props.activeCharacter);
		}

		const newPlayerCount = Object.keys(this.props.playerCharacters).length;
		if (newPlayerCount !== Object.keys(prevProps.playerCharacters).length) {
			this.updateControlBarColumnCount(newPlayerCount);
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

		if (this.props.conversationTarget && prevProps.conversationTarget !== this.props.conversationTarget) {
			this.setShowConversation();
		}
	}

	render() {
		const conversationTargetData = this.props.conversationTarget ?
			(this.props.conversationTarget.targetType === 'player' ?
			this.props.playerCharacters[this.props.conversationTarget.id] :
			this.props.npcs[this.props.conversationTarget.id]) : null;
		return (
			<div id='ui-container'>
				{this.state.showHelpSystem && this.helpPopupButton('map', {'left': '50%', 'top': '50%'})}

				{this.props.showDialog && this.props.dialogProps && <this.showDialog />}

				{this.state.needToShowObjectPanel && <this.showObjectPanel />}

				{this.props.contextMenu &&
				<ContextMenu
					actionsAvailable={this.props.contextMenu.actionsAvailable}
					inCombat={this.props.inTacticalMode && this.props.threatList.length > 0}
					creatureId={this.props.contextMenu.creatureId}
					processTileClick={this.processTileClick}
					handleUnitClick={this.props.handleUnitClick}
					setUserInteraction={this.props.setUserInteraction}
					setUserMove={this.props.setUserMove}
					handleContextMenuSelection={this.props.handleContextMenuSelection}
					menuPosStyle={this.calculatePanelCoords(this.props.contextMenu.evt.clientX, this.props.contextMenu.evt.clientY, 'menu')}
					buttonStyle={{width: '32px', height: '32px', backgroundPosition: 'center'}}
					showHelpSystem={this.state.showHelpSystem}
					helpPopupButton={this.helpPopupButton}
				/>}

				<div ref={this.uiRefs.turnInfo} id='turn-info-container' className='ui-panel'>
					<div ref={this.uiRefs.log} id='log-container'>
						{this.state.showHelpSystem && this.helpPopupButton('gameLog')}
						{this.state.logText &&
						<div className='log-lines'>
							<this.addLogLines />
						</div>
						}
					</div>

					{this.props.currentLocation &&
					<PartyInfoPanel
						currentLocation={this.props.currentLocation}
						currentFloor={this.props.currentFloor}
						partyLevel={this.props.partyLevel}
						partyExpertise={this.props.partyExpertise}
						expertisePointLevels={this.props.expertisePointLevels}
						setShowJournal={this.setShowJournal}
						showHelpSystem={this.state.showHelpSystem}
						helpPopupButton={this.helpPopupButton}
					/>}

					{this.props.modeInfo &&
					<ModeInfoPanel
						inTacticalMode={this.props.modeInfo.inTacticalMode}
						toggleTacticalMode={this.props.toggleTacticalMode}
						inSearchMode={this.props.inSearchMode}
						toggleSearchMode={this.props.toggleSearchMode}
						threatList={this.props.threatList}
						isPartyNearby={this.props.isPartyNearby}
						showDialog={this.props.showDialog}
						setShowDialogProps={this.props.setShowDialogProps}
						players={this.props.playerCharacters}
						activeCharacter={this.props.activeCharacter}
						updateActiveCharacter={this.props.updateActiveCharacter}
						playerFollowOrder={this.props.playerFollowOrder}
						updateFollowModePositions={this.props.updateFollowModePositions}
						updateCurrentTurn={this.props.updateCurrentTurn}
						showHelpSystem={this.state.showHelpSystem}
						helpPopupButton={this.helpPopupButton}
					/>}
					{/*<div className='minimize-button general-button' onClick={() => {*/}
					{/*	this.minimizePanel('turnInfo');*/}
					{/*}}>_</div>*/}
				</div>

				{this.state.showJournal &&
				<JournalWindow
					partyJournal={this.props.partyJournal}
					setShowJournal={this.setShowJournal}
				/>
				}

				{this.state.showConversation &&
				<ConversationWindow
					storyProgress={this.props.storyProgress}
					conversationTargetData={conversationTargetData}
					setConversationTarget={this.props.setConversationTarget}
					setShowConversation={this.setShowConversation}
					applyUpdatesFromConv={this.props.applyUpdatesFromConv}
					createdCharData={{gender: this.props.createdCharData.gender, name: this.props.createdCharData.name}}
					partySize={Object.keys(this.props.playerCharacters).length}
				/>
				}

				{this.props.selectedCharacterInfo &&
				<CharacterInfoPanel
					characterIsSelected={this.props.characterIsSelected}
					updateUnitSelectionStatus={this.props.updateUnitSelectionStatus}
					characterInfo={this.props.selectedCharacterInfo}
					assignLevelUpPoints={this.props.assignLevelUpPoints}
					switchEquipment={this.switchEquipment}
					updateCharacters={this.props.updateCharacters}
					characterInventoryIds={this.props.selectedCharacterInfo.inventory}
					showDialog={this.props.showDialog}
					setShowDialogProps={this.props.setShowDialogProps}
					setObjectSelected={this.setObjectSelected}
					setObjectPanelDisplayOption={this.setObjectPanelDisplayOption}
					dropItemToInv={this.dropItemToInv}
					dropItemToEquipped={this.dropItemToEquipped}
					setHasObjBeenDropped={this.props.setHasObjBeenDropped}
					notEnoughSpaceDialogProps={this.props.notEnoughSpaceDialogProps}
					objectIsSelected={this.state.objectIsSelected}
					showHelpSystem={this.state.showHelpSystem}
					helpPopupButton={this.helpPopupButton}
				/>
				}

				{this.props.selectedCreatureInfo &&
				<CreatureInfoPanel
					creatureIsSelected={this.props.creatureIsSelected}
					updateUnitSelectionStatus={this.props.updateUnitSelectionStatus}
					creatureInfo={this.props.selectedCreatureInfo}
					showHelpSystem={this.state.showHelpSystem}
					helpPopupButton={this.helpPopupButton}
				/>
				}

				<div id='system-buttons-container'>
					<div className='system-button help-button font-fancy' onClick={() => this.toggleHelpSystem()}>?</div>
					{this.state.showHelpSystem && this.helpPopupButton('systemButtons', {'left': '-40px'})}
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

				<div id='control-bar-container' ref={this.uiRefs.controlBar} className={`ui-panel ${this.state.controlBarColumnCount}`}>
					{/*<div className='minimize-button general-button' onClick={() => {*/}
					{/*	this.minimizePanel('controlBar');*/}
					{/*}}>_</div>*/}
					{this.props.playerCharacters && <this.showControlBar />}
				</div>

				{this.state.showHelpPopup &&
				<HelpPopup
					toggleHelpPopup={this.toggleHelpPopup}
					showHelpPopup={this.state.showHelpPopup}
				/>
				}

				{this.state.showGameOptions &&
				<GameOptions
					gameOptions={this.props.gameOptions}
					toggleOptionsPanel={this.toggleOptionsPanel}
					updateGameOptions={this.props.updateGameOptions}
					adjustMusicComponentVolume={this.adjustMusicComponentVolume}
					screenData={this.props.screenData}
					toggleNeedToSaveData={this.props.toggleNeedToSaveData}
					setShowDialogProps={this.props.setShowDialogProps}
					resetAllData={this.props.resetAllData}
				/>
				}

				<Music
					idProp={`music-${this.props.gameOptions.songName}-theme`}
					sourceName={this.props.gameOptions.songName}
				/>
			</div>
		);
	}
}

export default UI;
