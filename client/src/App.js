import React from 'react';
import Map from './Map';
import Character from "./Character";
import PlayerCharacterTypes from './playerCharacterTypes.json';
import WeaponTypes from './weaponTypes.json';
import UI from './UI';
import './css/app.css';
import './css/map.css';
import './css/mapPieceElements.css';
import './css/catacombs.css'
import './css/creatures.css';
import './css/playerCharacters.css';
import {diceRoll} from "./Utils";

class Game extends React.Component {
	constructor() {
		super();

		this.initialDialogText = 'Find the stairs down to enter a new dungeon! Use mouse or arrow keys to move and space bar to open/close doors.';
		this.startingLocation = 'catacombs';
		this.startingPlayerCharacters = ['privateEye'];

		this.state = {
			gameSetupComplete: false,
			playerCharacters: {},
			pcTypes: PlayerCharacterTypes,
			mapCreatures: {},
			unitsTurnOrder: [],
			currentTurn: 0,
			activeCharacter: '',
			characterIsSelected: false,
			characterInfoText: '',
			creatureIsSelected: false,
			creatureInfoText: '',
			creatureCoordsUpdate: null,
			selectedCharacter: '',
			selectedCreature: '',
			weaponButtonSelected: {},
			currentLocation: '',
			controlsContent: '',
			logText: [],
			showDialog: true,
			dialogProps: {
				dialogText: this.initialDialogText,
				closeButtonText: 'Close',
				actionButtonVisible: false,
				actionButtonText: '',
				actionButtonCallback:  null,
				dialogClasses: ''
			}
		}
	}

	setupGameState() {
		const gameReadyCallback = () => {
			this.setState({gameSetupComplete: true});
		}
		this.setupPlayerCharacters();
		this.setLocation(gameReadyCallback);
	}

	setupPlayerCharacters() {
		let playerCharacters = {};
		this.startingPlayerCharacters.forEach(character => {
			playerCharacters[character] = new Character(PlayerCharacterTypes[character]);
		});
		this.setState({playerCharacters});
	}

	setLocation(gameReadyCallback) {
		if (this.startingLocation) {
			this.setState({currentLocation: this.startingLocation}, gameReadyCallback);
		} else {
			// handle location change
		}
	}

	setAllUnitsTurnOrder() {
		let unitsTurnOrder = [];
		const sortInitiatives = (newUnitId, newUnitInitiative, unitType) => {
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
		};
		const calculateInitiatives = (unitType) => {
			for (const [id, charData] of Object.entries(this.state[unitType])) {
				const unitInitiative = charData.initiative + diceRoll(6);
				sortInitiatives(id, unitInitiative, unitType);
			}
		};

		calculateInitiatives('playerCharacters');
		calculateInitiatives('mapCreatures');
		this.setState({unitsTurnOrder}, () => {
			this.updateActiveCharacter();
		});
	}

	// if id is passed in, updating only one creature; otherwise updating all
	updateMapCreatures = (updateData, id, isInitialCreatureSetup = false) => {
		if (id) {
			this.setState(prevState => ({
				mapCreatures: {
					...prevState.mapCreatures,
					[id]: {...prevState.mapCreatures[id], ...updateData}
				}
			}), () => {
				if (this.state.selectedCreature === id) {
					this.updateInfoText('creatureInfoText', id);
				}
			});
		} else {
			this.setState({mapCreatures: updateData}, () => {
				if (isInitialCreatureSetup) {
					this.setAllUnitsTurnOrder();
				}
			});
		}
	}

	updatePlayerCharacter = (player, updateData, isEndOfTurn) => {
		this.setState(prevState => ({
			playerCharacters: {...prevState.playerCharacters, [player]: {...prevState.playerCharacters[player], ...updateData}}
		}), () => {
			if (isEndOfTurn) {
				this.updateCurrentTurn();
			}
		});
	}

	updateInfoText(type, id) {
		const updatedText = type === 'characterInfoText' ? this.state.playerCharacters[id] : this.state.mapCreatures[id];
		this.setState({[type]: updatedText});
	}

	updateLog = (logText) => {
		this.setState(prevState => ({
			logText: [...prevState.logText, logText]
		}));
	}

	toggleCharIsSelected = (type, status) => {
		const storageName = type === 'player' ? 'characterIsSelected' : 'creatureIsSelected';
		this.setState({[storageName]: status});
	}

	toggleWeapon = (characterId, weaponName) => {
		let buttonState = {};
		// if no weapon selected or weapon selected doesn't match new weapon selected, set weapon state to new weapon
		if (Object.keys(this.state.weaponButtonSelected).length === 0 ||
			(this.state.weaponButtonSelected.characterId !== characterId || this.state.weaponButtonSelected.weaponName !== weaponName)) {
			buttonState = {characterId, weaponName, stats: WeaponTypes[weaponName]};
		}
		this.setState({weaponButtonSelected: buttonState});
	}

	handleUnitClick = (id, type, isInRange) => {
		if (type === 'creature' && this.state.mapCreatures[id].currentHP <= 0) {
			return;
		}
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

		if (Object.keys(this.state.weaponButtonSelected).length > 0 && isInRange) {
			// selected unit is getting attacked
			const selectedWeaponInfo = this.state.weaponButtonSelected;

			this.state.playerCharacters[this.state.activeCharacter].attack(selectedWeaponInfo.stats, id, this.state.mapCreatures[id], this.updateMapCreatures, this.updateLog);

			if (this.state.mapCreatures[id].currentHP <= 0) {
				this.setState({creatureCoordsUpdate: id});
				this.updateLog(`${id} is dead!`);
			}
			this.animateCharacter();
			this.toggleWeapon(selectedWeaponInfo.characterId, selectedWeaponInfo.weaponName);
			this.updateCurrentTurn();
		} else {
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
				this.updateInfoText(infoTextToUpdate, id);
				this.toggleCharIsSelected(type, this.state[unitTypeObjectName][id].isSelected);
			});
		}
	}

	updateCurrentTurn = () => {
		const currentTurn = this.state.currentTurn === this.state.unitsTurnOrder.length - 1 ? 0 : this.state.currentTurn + 1;
		this.setState({currentTurn}, () => {
			this.updateActiveCharacter();
		});
	}

	updateActiveCharacter() {
		const currentTurnUnitInfo = Object.values(this.state.unitsTurnOrder[this.state.currentTurn])[0];
		this.setState({activeCharacter: currentTurnUnitInfo.id});
	}

	resetCreatureCoordsUpdate() {
		this.setState({creatureCoordsUpdate: null});
	}

	animateCharacter() {

	}

	setShowDialogProps = (showDialog, dialogText, closeButtonText, actionButtonVisible, actionButtonText, actionButtonCallback, dialogClasses) => {
		this.setState({showDialog, dialogProps: {dialogText, closeButtonText, actionButtonVisible, actionButtonText, actionButtonCallback, dialogClasses}});
	}

	componentDidMount() {
		if (!this.state.gameSetupComplete) {
			this.setupGameState();
		}
	}

	render() {
		return (
			<div className="game">

				<UI
					showDialog={this.state.showDialog}
					setShowDialogProps={this.setShowDialogProps}
					dialogProps={this.state.dialogProps}
					logText={this.state.logText}
					characterInfoText={this.state.characterInfoText}
					creatureInfoText={this.state.creatureInfoText}
					controlsContent={this.state.playerCharacters}
					characterIsSelected={this.state.characterIsSelected}
					creatureIsSelected={this.state.creatureIsSelected}
					weaponButtonSelected={this.state.weaponButtonSelected}
					toggleWeapon={this.toggleWeapon}
				/>

				{this.state.gameSetupComplete &&
					<Map
						setShowDialogProps={this.setShowDialogProps}
						pcTypes={this.state.pcTypes}
						playerCharacters={this.state.playerCharacters}
						activeCharacter={this.state.activeCharacter}
						updatePlayerChar={this.updatePlayerCharacter}
						mapCreatures={this.state.mapCreatures}
						updateCreatures={this.updateMapCreatures}
						currentTurn={this.state.currentTurn}
						updateCurrentTurn={this.updateCurrentTurn}
						unitsTurnOrder={this.state.unitsTurnOrder}
						creatureCoordsUpdate={this.state.creatureCoordsUpdate}
						creatureUpdateReset={this.resetCreatureCoordsUpdate}
						currentLocation={this.state.currentLocation}
						updateLog={this.updateLog}
						unitClickHandler={this.handleUnitClick}
						weaponButtonSelected={this.state.weaponButtonSelected}
					/>
				}

			</div>
		);
	}
}

function App() {
	return (
		<Game/>
	);
}

export default App;
