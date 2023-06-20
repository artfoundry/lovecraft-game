import React from 'react';
import {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, ModeInfoPanel, DialogWindow} from './UIElements';
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
			entireInventory: {}
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
					ammo={playerInfo.ammo}
					toggleActionButton={this.props.toggleActionButton}
					itemButtonSelected={this.props.itemButtonSelected}
					isActiveCharacter={id === this.props.activeCharacter}
					movesRemaining={this.props.playerLimits.moves - this.props.actionsCompleted.moves}
					actionsRemaining={this.props.playerLimits.actions - this.props.actionsCompleted.actions}
					inTacticalMode={this.props.inTacticalMode}
					updateCharacters={this.props.updateCharacters}
					entireInventory={this.state.entireInventory}
					updateInventory={this.updateInventory}
					setShowDialogProps={this.props.setShowDialogProps}
				/>
			)
		}
		return controlPanels;
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

	updateInventory = (id, updatedList, callback) => {
		this.setState(prevState => ({
			entireInventory: {...prevState.entireInventory, [id]: updatedList}
		}), () => {
			if (callback) callback();
		});
	}

	_parseInvItems(charId, invItemsList){
		const charInfo = this.props.playerCharacters[charId];
		const stackableWeapons = charInfo.ammo.stackable;
		const allItems = Object.assign({...charInfo.weapons}, {...charInfo.items});
		const equippedItems = charInfo.equippedItems;
		let stackablesAdded = []; // prevents listing multiple copies of same stackable weapon
		// const charId = this.props.selectedCharacterInfo.id;
		// let invItemsList = [...this.state.entireInventory[charId]];

		for (const [itemId, itemInfo] of Object.entries(allItems)) {
			if (itemId !== equippedItems.loadout1.right && itemId !== equippedItems.loadout1.left &&
				!stackablesAdded[itemInfo.name] && invItemsList.indexOf(itemId) === -1)
			{
				const emptyBox = invItemsList.indexOf(null);
				invItemsList.splice(emptyBox, 1, itemId);

				if (stackableWeapons && stackableWeapons[itemInfo.name]) {
					stackablesAdded.push(itemInfo.name);
				}
			}
		}

		let updatedInventory = [];
		for (let i=0; i < this.inventoryLength; i++) {
			updatedInventory.push(invItemsList[i] || null);
		}
		this.setState(prevState => ({
			entireInventory: {...prevState.entireInventory, [charId]: updatedInventory}
		}));
	}

	_calculateAmmo() {
		let list = [];
		let gunAmmo = {...this.props.selectedCharacterInfo.ammo};
		delete gunAmmo.stackable;

		for (const [type, amount] of Object.entries(gunAmmo)) {
			list.push(<span key={type + Math.random()}>{type}: {amount} rounds</span>)
		}
		return list;
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
			this._parseInvItems(this.props.selectedCharacterInfo.id, [...this.state.entireInventory[this.props.selectedCharacterInfo.id]]);
		}
	}

	render() {
		return (
			<div className='ui-container'>
				{this.props.showDialog && this.props.dialogProps && <this.showDialog />}

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
						ammoList={this._calculateAmmo()}
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
