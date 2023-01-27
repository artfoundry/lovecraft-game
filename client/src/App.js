import React from 'react';
import Map from './Map';
import Character from "./Character";
import PlayerCharacterTypes from './playerCharacterTypes.json';
import UI from './UI';
import './css/app.css';
import './css/map.css';
import './css/mapPieceElements.css';
import './css/catacombs.css'
import './css/creatures.css';
import './css/playerCharacters.css';

class Game extends React.Component {
	constructor() {
		super();

		this.initialDialogText = 'Find the stairs down to enter a new dungeon! Use mouse or arrow keys to move and space bar to open/close doors.';

		this.state = {
			playerCharacters: {privateEye: new Character(PlayerCharacterTypes['privateEye'])},
			mapCreatures: {},
			activeCharacter: 'privateEye',
			characterIsSelected: false,
			creatureIsSelected: false,
			selectedCharacter: '',
			selectedCreature: '',
			weaponButtonSelected: {},
			characterInfoText: '',
			controlsContent: '',
			pcTypes: PlayerCharacterTypes,
			currentLocation: 'catacombs',
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

	updateMapCreatures = (creatureData) => {
		this.setState({mapCreatures: creatureData})
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

	toggleWeapon = (characterName, weapon) => {
		let buttonState = {};
		// if no weapon selected or weapon selected doesn't match new weapon selected, set weapon state to new weapon
		if (Object.keys(this.state.weaponButtonSelected).length === 0 ||
			(this.state.weaponButtonSelected.characterName !== characterName || this.state.weaponButtonSelected.weapon !== weapon)) {
			buttonState = {characterName, weapon};
		}
		this.setState({weaponButtonSelected: buttonState});
	}

	handleUnitClick = (id, type) => {
		let unitTypeObjectName = '';
		let unitTypeSelected = '';
		let unitNameForSelectionStateChg = '';
		let unitToDeselect = '';

		if (type === 'player') {
			unitTypeObjectName = 'playerCharacters';
			unitTypeSelected = 'selectedCharacter';
		} else if (type === 'creature') {
			unitTypeObjectName = 'mapCreatures';
			unitTypeSelected = 'selectedCreature';
		}

		if (Object.keys(this.state.weaponButtonSelected).length > 0) {
			// selected unit is getting attacked
			const selectedWeaponInfo = this.state.weaponButtonSelected;

		// need to check that creature clicked is within range of weapon's range
			// attack() directly modifies currentHP in creature object
			this.state.playerCharacters[this.state.activeCharacter].attack(selectedWeaponInfo.weapon, this.state.mapCreatures[id]);

			if (this.state.mapCreatures[id].currentHP <= 0) {
				this.deleteCreature(id);
			}
			this.animateCharacter();
			this.toggleWeapon(selectedWeaponInfo.characterName, selectedWeaponInfo.weapon);
		} else {
			if (this.state.selectedCharacter === id || this.state.selectedCreature === id) {
				// selected character was just clicked to deselect
				unitNameForSelectionStateChg = '';
			} else {
				// no unit previously selected or different unit previously selected
				unitNameForSelectionStateChg = id;

				if (this.state[unitTypeSelected] !== '') {
					unitToDeselect = this.state[unitTypeSelected];
				}
			}

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
			});
		}
	}

	animateCharacter() {

	}

	deleteCreature(id) {

	}

	setShowDialogProps = (showDialog, dialogText, closeButtonText, actionButtonVisible, actionButtonText, actionButtonCallback, dialogClasses) => {
		this.setState({showDialog, dialogProps: {dialogText, closeButtonText, actionButtonVisible, actionButtonText, actionButtonCallback, dialogClasses}});
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
					controlsContent={this.state.playerCharacters}
					characterIsSelected={this.state.characterIsSelected}
					creatureIsSelected={this.state.creatureIsSelected}
					weaponButtonSelected={this.state.weaponButtonSelected}
					toggleWeapon={this.toggleWeapon}
				/>

				<Map
					setShowDialogProps={this.setShowDialogProps}
					pcTypesProp={this.state.pcTypes}
					playerCharsProp={this.state.playerCharacters}
					mapCreaturesProp={this.state.mapCreatures}
					updateCreaturesProp={this.updateMapCreatures}
					activeCharProp={this.state.activeCharacter}
					locationProp={this.state.currentLocation}
					logUpdateProp={this.updateLog}
					unitClickHandlerProp={this.handleUnitClick}
					charIsSelectedProp={this.toggleCharIsSelected}
					weaponButtonSelectedProp={this.state.weaponButtonSelected}
				/>

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
