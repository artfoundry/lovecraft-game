import React from 'react';
import {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, ObjectInfoPanel, ModeInfoPanel, DialogWindow} from './UIElements';
import './css/ui.css';

class UI extends React.Component {
	constructor(props) {
		super(props);

		this.uiPanelHeight = 95;
		this.inventoryLength = 12;

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
			objectSelected: {}
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
				/>
			)
		}
		return controlPanels;
	}

	setObjectSelected = (objectSelected, evt) => {
		const selectedObjPos = evt ? {left: evt.clientX, top: evt.clientY - 230} : null;
		const objectIsSelected = objectSelected !== null && !this.state.objectIsSelected;
		this.setState({objectSelected, objectIsSelected, selectedObjPos});
		if (this.props.objectSelected && !objectSelected) {
			this.props.setObjectSelected(null);
		}
	}

	showObjectPanel = () => {
		return (
			<ObjectInfoPanel
				objectInfo={this.state.objectSelected}
				updateInventory={this.updateInventory}
				characterInfo={this.props.selectedCharacterInfo}
				updateCharacters={this.props.updateCharacters}
				setObjectSelected={this.setObjectSelected}
				selectedObjPos={this.state.selectedObjPos}
			/>
		)
	}

	switchEquipment = (id) => {
		const updateData = {...this.props.playerCharacters[id]};
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
		this.setState(prevState => ({
			entireInventory: {...prevState.entireInventory, [id]: updatedList}
		}), () => {
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

		// need to fill in the rest of the inv slots with null, so char info panel shows empty boxes
		let updatedInventory = [];
		for (let i=0; i < this.inventoryLength; i++) {
			updatedInventory.push(tempInvList[i] || null);
		}
		this.setState(prevState => ({
			entireInventory: {...prevState.entireInventory, [charId]: updatedInventory}
		}));
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
			const objectInfo = {...this.props.objectSelected.object, isMapObj: true};
			this.setObjectSelected(objectInfo, this.props.objectSelected.evt);
		}
	}

	render() {
		return (
			<div className='ui-container'>
				{this.props.showDialog && this.props.dialogProps && <this.showDialog />}

				{this.state.objectIsSelected && <this.showObjectPanel />}

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
