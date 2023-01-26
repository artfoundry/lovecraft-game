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

		this.state = {
			playerCharacters: {privateEye: new Character(PlayerCharacterTypes['privateEye'])},
			mapCreatures: {},
			activePC: 'privateEye',
			dialogClasses: 'dialog',
			dialogText: 'Find the stairs down to enter a new dungeon! Use mouse or arrow keys to move and space bar to open/close doors.',
			closeButtonText: 'Close',
			actionButtonVisible: false,
			actionButtonText: '',
			actionButtonCallback: null,
			characterIsSelected: false,
			creatureIsSelected: false,
			selectedCharacter: '',
			selectedCreature: '',
			weaponButtonSelected: {},
			characterInfoText: '',
			controlsContent: '',
			pcTypes: PlayerCharacterTypes,
			currentLocation: 'catacombs',
			logText: []
		}
	}

	updateMapCreatures = (creatureData) => {
		this.setState({mapCreatures: creatureData})
	}

	showDialog = (dialogText, closeButtonText, actionButtonVisible, actionButtonText, actionButtonCallback) => {
		this.setState({
			dialogClasses: 'dialog',
			dialogText,
			closeButtonText,
			actionButtonVisible,
			actionButtonText,
			actionButtonCallback
		});
	}

	closeDialog = () => {
		this.setState({dialogClasses: 'hide'});
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
			(this.state.weaponButtonSelected.characterName !== characterName && this.state.weaponButtonSelected.weapon !== weapon)) {
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
			this.state.activeCharacter.attack(this.state.mapCreatures[id]);
			if (this.state.mapCreatures[id].currentHP <= 0) {
				this.deleteCreature(id);
			}
			this.animateCharacter();
			this.toggleWeaponButton(this.state.weaponButtonSelected.characterName, this.state.weaponButtonSelected.weapon);
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

	render() {
		return (
			<div className="game">
				<div className={this.state.dialogClasses}>
					<div className="dialog-message">{this.state.dialogText}
						<br/><br/> PC: {`${this.state.playerCharacters[this.state.activePC].name}, ${this.state.playerCharacters[this.state.activePC].profession}`}
					</div>
					<div className="dialog-buttons">
						<button className="dialog-button"
						        onClick={this.closeDialog}>{this.state.closeButtonText}</button>
						<button
							className={`dialog-button ${this.state.actionButtonVisible ? '' : 'hide'}`}
							onClick={() => {
								this.state.actionButtonCallback();
								this.closeDialog();
							}}>
							{this.state.actionButtonText}
						</button>
					</div>
				</div>

				<UI
					logTextProp={this.state.logText}
					characterInfoTextProp={this.state.characterInfoText}
					controlsContentProp={this.state.playerCharacters}
					characterIsSelectedProp={this.state.characterIsSelected}
					creatureIsSelectedProp={this.state.creatureIsSelected}
					weaponButtonSelectedProp={this.state.weaponButtonSelected}
					toggleWeaponProp={this.toggleWeapon}
				/>

				<Map
					showDialogProp={this.showDialog}
					pcTypesProp={this.state.pcTypes}
					playerCharsProp={this.state.playerCharacters}
					updateCreaturesProp={this.updateMapCreatures}
					activeCharProp={this.state.activePC}
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
