import React from 'react';
import Firebase from './Firebase';
import Map from './Map';
import Character from './Character';
import PlayerCharacterTypes from './data/playerCharacterTypes.json';
import WeaponTypes from './data/weaponTypes.json';
import UI from './UI';
import './css/app.css';
import './css/map.css';
import './css/mapPieceElements.css';
import './css/catacombs.css'
import './css/creatures.css';
import './css/playerCharacters.css';
import {diceRoll} from './Utils';

class Game extends React.Component {
	constructor(props) {
		super(props);

		this.initialDialogContent = 'Find the stairs down to enter a new dungeon! Use mouse or arrow keys to move and space bar to open/close doors.';
		this.startingLocation = 'catacombs';
		this.startingPlayerCharacters = ['privateEye'];
		this.playerMovesLimit = 3;
		this.playerActionsLimit = 1;

		this.firebase = new Firebase();

		this.state = {
			userData: {},
			isLoggedIn: false,
			gameSetupComplete: false,
			playerCharacters: {},
			pcTypes: PlayerCharacterTypes,
			mapCreatures: {},
			unitsTurnOrder: [],
			currentTurn: 0,
			activeCharacter: this.startingPlayerCharacters[0],
			activePlayerMovesCompleted: 0,
			activePlayerActionsCompleted: 0,
			currentLocation: '',
			characterIsSelected: false,
			characterInfoText: '',
			creatureIsSelected: false,
			creatureInfoText: '',
			creatureCoordsUpdate: null,
			selectedCharacter: '',
			selectedCreature: '',
			weaponButtonSelected: {},
			isInCombat: false,
			logText: [],
			showDialog: true,
			dialogProps: {
				dialogContent: this.initialDialogContent,
				closeButtonText: 'Close',
				actionButtonVisible: false,
				actionButtonText: '',
				actionButtonCallback:  null,
				dialogClasses: ''
			}
		}
	}

	/**
	 * Updates state to true once login is completed by Firebase component
	 */
	updateLoggedIn = (userData) => {
		this.setState({
			isLoggedIn: true,
			userData
		});
	}

	/**
	 * Updates either creature or player character data collection to state
	 * If id is passed in, updating only one creature; otherwise updating all
	 * @param type: String
	 * @param updateData: Object
	 * @param id: String
	 * @param isInitialCreatureSetup: Boolean
	 * @param callback: Function
	 */
	updateCharacters = (type, updateData, id, isInitialCreatureSetup = false, callback) => {
		const collection = type === 'player' ? 'playerCharacters' : 'mapCreatures';
		if (id) {
			this.setState(prevState => ({
				[collection]: {
					...prevState[collection],
					[id]: {...prevState[collection][id], ...updateData}
				}
			}), () => {
				if (this.state.selectedCreature === id) {
					if (this.state[collection][id].currentHP <= 0 && type === 'creature') {
						this._updateUnitSelectionStatus(id, 'creature');
					} else {
						this._updateInfoText('creatureInfoText', id);
					}
				}
				if (callback) callback();
			});
		} else {
			this.setState({[collection]: updateData}, () => {
				if (isInitialCreatureSetup) {
					this._setAllUnitsTurnOrder();
				}
				if (callback) callback();
			});
		}
	}

	/**
	 * Gets the positions for each LIVING character of a genre, player or creature
	 * @param type: String (player or creature)
	 * @param format: String (pos (string) or coords (object))
	 * @returns Array (of Objects {id: coords})
	 */
	getAllCharactersPos = (type, format) => {
		const allCharactersPos = [];
		const collection = type === 'player' ? this.state.playerCharacters : this.state.mapCreatures;
		for (const [id, characterData] of Object.entries(collection)) {
			if (characterData.currentHP > 0) {
				let coords = format === 'pos' ? `${characterData.coords.xPos}-${characterData.coords.yPos}` : characterData.coords;
				allCharactersPos.push({id, [format]: coords});
			}
		}
		return allCharactersPos;
	}

	/**
	 * Updates to state the contents of the log window in UI
	 * @param logText: String
	 */
	updateLog = (logText) => {
		this.setState(prevState => ({
			logText: [...prevState.logText, logText]
		}));
	}

	/**
	 * Updates to state whether a PC or NPC is selected
	 * For quick and public checking of selection status vs _updateUnitSelectionStatus which is private and contains a lot more info
	 * @param type: String
	 * @param status: Boolean
	 */
	toggleCharIsSelected = (type, status) => {
		const storageName = type === 'player' ? 'characterIsSelected' : 'creatureIsSelected';
		this.setState({[storageName]: status});
	}

	/**
	 * Updates to state what PC weapon is selected in the UI
	 * @param characterId: String
	 * @param weaponName: String
	 */
	toggleWeapon = (characterId, weaponName) => {
		let buttonState = {};
		// if no weapon selected or weapon selected doesn't match new weapon selected, set weapon state to new weapon
		if (Object.keys(this.state.weaponButtonSelected).length === 0 ||
			(this.state.weaponButtonSelected.characterId !== characterId || this.state.weaponButtonSelected.weaponName !== weaponName)) {
			buttonState = {characterId, weaponName, stats: WeaponTypes[weaponName]};
		}
		this.setState({weaponButtonSelected: buttonState});
	}

	/**
	 * User click handler for clicking on units to determine if it's being selected or acted upon (ie. attacked)
	 * @param id
	 * @param type
	 * @param isInRange
	 */
	handleUnitClick = (id, type, isInRange) => {
		if (Object.keys(this.state.weaponButtonSelected).length > 0 && isInRange) {
			if (this.state.activePlayerActionsCompleted === this.playerActionsLimit) {
				const showDialog = true;
				const dialogContent = `${this.state.playerCharacters[this.state.activeCharacter].name} has no more actions this turn`;
				const closeButtonText = 'Ok';
				const actionButtonVisible = false;
				const actionButtonText = '';
				const actionButtonCallback = null;
				const dialogClasses = '';
				this.setShowDialogProps(showDialog, dialogContent, closeButtonText, actionButtonVisible, actionButtonText, actionButtonCallback, dialogClasses);
				return;
			}

			// clicked unit is getting attacked
			const selectedWeaponInfo = this.state.weaponButtonSelected;

			this.state.playerCharacters[this.state.activeCharacter].attack(selectedWeaponInfo.stats, id, this.state.mapCreatures[id], this.updateCharacters, this.updateLog);
			this._animateCharacter();
			this.toggleWeapon(selectedWeaponInfo.characterId, selectedWeaponInfo.weaponName);
			if (this.state.mapCreatures[id].currentHP <= 0) {
				this._removeDeadFromTurnOrder(id);
			}
			this._updateActivePlayerActions();
		} else {
			this._updateUnitSelectionStatus(id, type);
		}
	}

	/**
	 * Increments and sets to state the current turn number (or resets if on last turn of unitTurnOrder),
	 * as well as resets number of moves and actions taken by the active PC
	 * then calls function to update what is the active character
	 */
	updateCurrentTurn = () => {
		const currentTurn = this.state.currentTurn === this.state.unitsTurnOrder.length - 1 ? 0 : this.state.currentTurn + 1;
		this.setState({currentTurn, activePlayerActionsCompleted: 0, activePlayerMovesCompleted: 0}, () => {
			this._updateActiveCharacter();
		});
	}

	/**
	 * Increments and sets to state the number of moves made by the active PC,
	 * then runs callback to update the current turn if PC has used up all actions and moves
	 */
	updateActivePlayerMoves = () => {
		const activePlayerMovesCompleted = this.state.activePlayerMovesCompleted + 1;
		this.setState({activePlayerMovesCompleted}, () => {
			if (this.state.activePlayerMovesCompleted === this.playerMovesLimit && this.state.activePlayerActionsCompleted === this.playerActionsLimit) {
	//todo: don't think timeout is needed anymore
				// setTimeout(() => {
				this.updateCurrentTurn();
				// }, 500);
			}
		});
	}

	/**
	 * Sets props for main dialog window. showDialog determines whether dialog is shown
	 * and rest determine dialog content
	 * @param showDialog: boolean
	 * @param dialogContent: string
	 * @param closeButtonText: string
	 * @param actionButtonVisible: boolean
	 * @param actionButtonText: string
	 * @param actionButtonCallback: function
	 * @param dialogClasses: string
	 * @param disableCloseButton: boolean
	 */
	setShowDialogProps = (showDialog, dialogContent, closeButtonText, actionButtonVisible, actionButtonText, actionButtonCallback, dialogClasses, disableCloseButton) => {
		this.setState({showDialog, dialogProps: {dialogContent, closeButtonText, actionButtonVisible, actionButtonText, actionButtonCallback, dialogClasses, disableCloseButton}});
	}



	/*********************
	 * PRIVATE FUNCTIONS
	 *********************/


	/**
	 * Initialization function. gameSetupComplete in callback indicates Map component can render
	 * @private
	 */
	_setupGameState() {
		const gameReadyCallback = () => {
			this.setState({gameSetupComplete: true});
		}
		this._setupPlayerCharacters();
		this._setLocation(gameReadyCallback);
	}

	/**
	 * Saves starting player chars to state as part of initialization
	 * @private
	 */
	_setupPlayerCharacters() {
		let playerCharacters = {};
		this.startingPlayerCharacters.forEach(character => {
			playerCharacters[character] = new Character(PlayerCharacterTypes[character]);
		});
		this.setState({playerCharacters});
	}

	/**
	 * Saves new game location to state. For game init, runs callback to set gameSetupComplete to true.
	 * @param gameReadyCallback: function
	 * @private
	 */
	_setLocation(gameReadyCallback) {
		if (this.startingLocation) {
			this.setState({currentLocation: this.startingLocation}, gameReadyCallback);
		} else {
			// handle location change
		}
	}

	/**
	 * Sorts list of both player and non-player chars in map based on initiative value for taking turns
	 * No return value as unitsTurnOrder array is modified directly by address
	 * @param unitsTurnOrder: Array (of objects)
	 * @param newUnitId: String
	 * @param newUnitInitiative: Integer
	 * @param unitType: String
	 * @private
	 */
	_sortInitiatives (unitsTurnOrder, newUnitId, newUnitInitiative, unitType) {
		if (unitsTurnOrder.length === 0) {
			unitsTurnOrder.push({[newUnitInitiative]: {id: newUnitId, unitType}});
		} else {
			let i = 0;
			let notSorted = true;
			while (notSorted) {
				const sortedUnitInitValue = Object.keys(unitsTurnOrder[i])[0];
				const sortedUnitOrderInfo = unitsTurnOrder[i][sortedUnitInitValue];
				const sortedUnitId = sortedUnitOrderInfo.id;
				const sortedUnitTypeCollection = this.state[sortedUnitOrderInfo.unitType];
				const sortedUnitData = sortedUnitTypeCollection[sortedUnitId];
				const newUnitTypeCollection = this.state[unitType];
				const newUnitData = newUnitTypeCollection[newUnitId];
				// if new init value is greater or
				// inits are the same and new unit agility is greater
				// or inits and agilities are the same and new unit mental acuity is greater
				// or all the same and flip of a coin is 1, then add to the front
				if (newUnitInitiative > sortedUnitInitValue ||
					(newUnitInitiative === sortedUnitInitValue && newUnitData.agility > sortedUnitData.agility) ||
					(newUnitInitiative === sortedUnitInitValue &&
						newUnitData.agility === sortedUnitData.agility &&
						newUnitData.mentalAcuity > sortedUnitData.mentalAcuity) ||
					(newUnitInitiative === sortedUnitInitValue &&
						newUnitData.agility === sortedUnitData.agility &&
						newUnitData.mentalAcuity === sortedUnitData.mentalAcuity &&
						diceRoll(2) === 1)
				) {
					unitsTurnOrder.splice(i, 0, {[newUnitInitiative]: {id: newUnitId, unitType}});
					notSorted = false;
				} else if (i === unitsTurnOrder.length - 1) {
					unitsTurnOrder.push({[newUnitInitiative]: {id: newUnitId, unitType}});
					notSorted = false;
				}
				i++;
			}
		}
	}

	/**
	 * Calculates initiative values for each PC and NPC in map,
	 * then saves turn order array to state,
	 * then calls function to set the active character (based on turn order)
	 * @private
	 */
	_setAllUnitsTurnOrder() {
		let unitsTurnOrder = [];
		const calculateInitiatives = (unitType) => {
			for (const [id, charData] of Object.entries(this.state[unitType])) {
				const unitInitiative = charData.initiative + diceRoll(6);
				this._sortInitiatives(unitsTurnOrder, id, unitInitiative, unitType);
			}
		};

		calculateInitiatives('playerCharacters');
		calculateInitiatives('mapCreatures');
		this.setState({unitsTurnOrder}, () => {
			this._updateActiveCharacter();
		});
	}

	/**
	 * Updates character info panels contents to state
	 * @param type: String
	 * @param id: String
	 * @private
	 */
	_updateInfoText(type, id) {
		const updatedText = type === 'characterInfoText' ? this.state.playerCharacters[id] : this.state.mapCreatures[id];
		this.setState({[type]: updatedText});
	}

	/**
	 * Updates to state the status of what PC or NPC (or both) is selected in the UI,
	 * then calls function to update info panel text for that character
	 * @param id: String
	 * @param type: String
	 * @private
	 */
	_updateUnitSelectionStatus(id, type) {
		let unitTypeObjectName = '';
		let unitTypeSelected = '';
		let unitNameForSelectionStateChg = '';
		let unitToDeselect = '';
		let infoTextToUpdate = '';

		if (type === 'player') {
			unitTypeObjectName = 'playerCharacters';
			unitTypeSelected = 'selectedCharacter';
		} else if (type === 'creature') {
			unitTypeObjectName = 'mapCreatures';
			unitTypeSelected = 'selectedCreature';
		}

		// clicked unit is being selected/deselected
		if (this.state.selectedCharacter === id || this.state.selectedCreature === id) {
			// selected character was just clicked to deselect
			unitNameForSelectionStateChg = '';
		} else {
			// no unit previously selected or different unit previously selected
			unitNameForSelectionStateChg = id;

			infoTextToUpdate = type === 'player' ? 'characterInfoText' : 'creatureInfoText';

			if (this.state[unitTypeSelected] !== '') {
				unitToDeselect = this.state[unitTypeSelected];
			}
		}

		// toggle selected state of clicked unit
		this.setState(prevState => ({
			[unitTypeSelected]: unitNameForSelectionStateChg,
			[unitTypeObjectName]: {
				...prevState[unitTypeObjectName],
				[id]: {
					...prevState[unitTypeObjectName][id],
					isSelected: !prevState[unitTypeObjectName][id].isSelected
				}
			}
		}), () => {
			if (unitToDeselect !== '') {
				this.setState(prevState => ({
					[unitTypeObjectName]: {
						...prevState[unitTypeObjectName],
						[unitToDeselect]: {
							...prevState[unitTypeObjectName][unitToDeselect],
							isSelected: !prevState[unitTypeObjectName][unitToDeselect].isSelected
						}
					}
				}));
			}
			this.toggleCharIsSelected(type, this.state[unitTypeObjectName][id].isSelected);
			if (this.state[unitTypeObjectName][id].isSelected) {
				this._updateInfoText(infoTextToUpdate, id);
			}
		});
	}

	/**
	 * Updates to state what character is active (PC or NPC)
	 * @private
	 */
	_updateActiveCharacter() {
		const currentTurnUnitInfo = Object.values(this.state.unitsTurnOrder[this.state.currentTurn])[0];
		this.setState({activeCharacter: currentTurnUnitInfo.id});
	}

	/**
	 * Increments and updates to state number of actions the active PC has done,
	 * then runs callback to update current turn if all moves and actions are done
	 * @private
	 */
	_updateActivePlayerActions() {
		const activePlayerActionsCompleted = this.state.activePlayerActionsCompleted + 1;
		this.setState({activePlayerActionsCompleted}, () => {
			if (this.state.activePlayerMovesCompleted === this.playerMovesLimit && this.state.activePlayerActionsCompleted === this.playerActionsLimit) {
	//todo: don't think timeout is needed anymore
				// setTimeout(() => {
				this.updateCurrentTurn();
				// }, 500);
			}
		});
	}

	/**
	 * Updates to state the turn order with the dead unit removed and
	 * a flag used for indicating if there's an update to creature coords (in Map), such as creature dying
	 * @param id: String
	 * @private
	 */
	_removeDeadFromTurnOrder(id) {
		let unitsTurnOrder = this.state.unitsTurnOrder;
		let unitNotFound = true;
		let index = 0;
		while (unitNotFound && index < this.state.unitsTurnOrder.length) {
			const unitInfo = Object.values(this.state.unitsTurnOrder[index])[0];
			if (unitInfo.id === id) {
				unitNotFound = false;
				unitsTurnOrder.splice(index, 1);
			}
			index++;
		}
		this.updateLog(`${id} is dead!`);
	}

	_animateCharacter() {

	}


	/***************************
	 * REACT LIFECYCLE FUNCTIONS
	 ***************************/

	componentDidMount() {
		if (!this.state.gameSetupComplete) {
			this._setupGameState();
		}
	}

	render() {
		return (
			<div className="game">
				<Firebase
					updateLoggedIn={this.updateLoggedIn}
				/>

				{this.state.isLoggedIn &&
					<UI
						showDialog={this.state.showDialog}
						setShowDialogProps={this.setShowDialogProps}
						dialogProps={this.state.dialogProps}
						logText={this.state.logText}
						characterInfoText={this.state.characterInfoText}
						creatureInfoText={this.state.creatureInfoText}
						characterIsSelected={this.state.characterIsSelected}
						creatureIsSelected={this.state.creatureIsSelected}
						weaponButtonSelected={this.state.weaponButtonSelected}
						toggleWeapon={this.toggleWeapon}
						updateCurrentTurn={this.updateCurrentTurn}
						activeCharacter={this.state.activeCharacter}
						playerCharacters={this.state.playerCharacters}
						actionsCompleted={{moves: this.state.activePlayerMovesCompleted, actions: this.state.activePlayerActionsCompleted}}
						playerLimits={{moves: this.playerMovesLimit, actions: this.playerActionsLimit}}
					/>
				}

				{this.state.isLoggedIn && this.state.gameSetupComplete &&
					<Map
						setShowDialogProps={this.setShowDialogProps}
						pcTypes={this.state.pcTypes}
						playerCharacters={this.state.playerCharacters}
						activeCharacter={this.state.activeCharacter}
						getAllCharactersPos={this.getAllCharactersPos}
						activePlayerMovesCompleted={this.state.activePlayerMovesCompleted}
						playerMovesLimit={this.playerMovesLimit}
						updateActivePlayerMoves={this.updateActivePlayerMoves}
						mapCreatures={this.state.mapCreatures}
						updateCharacters={this.updateCharacters}
						currentTurn={this.state.currentTurn}
						updateCurrentTurn={this.updateCurrentTurn}
						unitsTurnOrder={this.state.unitsTurnOrder}
						currentLocation={this.state.currentLocation}
						updateLog={this.updateLog}
						handleUnitClick={this.handleUnitClick}
						weaponButtonSelected={this.state.weaponButtonSelected}
					/>
				}

			</div>
		);
	}
}

export default Game;
