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

class Game extends React.Component {
	constructor() {
		super();

		this.initialDialogText = 'Find the stairs down to enter a new dungeon! Use mouse or arrow keys to move and space bar to open/close doors.';

		this.state = {
			playerCharacters: {privateEye: new Character(PlayerCharacterTypes['privateEye'])},
			mapCreatures: {},
			activeCharacter: 'privateEye',
			characterIsSelected: false,
			characterInfoText: '',
			creatureIsSelected: false,
			creatureInfoText: '',
			creatureCoordsUpdate: null,
			selectedCharacter: '',
			selectedCreature: '',
			weaponButtonSelected: {},
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

	updateMapCreatures = (updateData, id) => {
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
			this.setState({mapCreatures: updateData});
		}
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

	toggleWeapon = (characterName, weapon) => {
		let buttonState = {};
		// if no weapon selected or weapon selected doesn't match new weapon selected, set weapon state to new weapon
		if (Object.keys(this.state.weaponButtonSelected).length === 0 ||
			(this.state.weaponButtonSelected.characterName !== characterName || this.state.weaponButtonSelected.weapon !== weapon)) {
			buttonState = {characterName, weapon, stats: WeaponTypes[weapon]};
		}
		this.setState({weaponButtonSelected: buttonState});
	}

	handleUnitClick = (id, type, isInRange) => {
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

		if (Object.keys(this.state.weaponButtonSelected).length > 0 && isInRange && this.state.mapCreatures[id].currentHP > 0) {
			// selected unit is getting attacked
			const selectedWeaponInfo = this.state.weaponButtonSelected;

// need to check that creature clicked is within range of weapon's range
			this.state.playerCharacters[this.state.activeCharacter].attack(selectedWeaponInfo.weapon, id, this.state.mapCreatures[id], this.updateMapCreatures, this.updateLog);

			if (this.state.mapCreatures[id].currentHP <= 0) {
				this.setState({creatureCoordsUpdate: id});
				this.updateLog(`${id} is dead!`);
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

				infoTextToUpdate = type === 'player' ? 'characterInfoText' : 'creatureInfoText';

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
				this.updateInfoText(infoTextToUpdate, id);
				this.toggleCharIsSelected(type, this.state[unitTypeObjectName][id].isSelected);
			});
		}
	}

	resetCreatureCoordsUpdate() {
		this.setState({creatureCoordsUpdate: null});
	}

	animateCharacter() {

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
					creatureInfoText={this.state.creatureInfoText}
					controlsContent={this.state.playerCharacters}
					characterIsSelected={this.state.characterIsSelected}
					creatureIsSelected={this.state.creatureIsSelected}
					weaponButtonSelected={this.state.weaponButtonSelected}
					toggleWeapon={this.toggleWeapon}
				/>

				<Map
					setShowDialogProps={this.setShowDialogProps}
					pcTypes={this.state.pcTypes}
					playerChars={this.state.playerCharacters}
					activeChar={this.state.activeCharacter}
					mapCreatures={this.state.mapCreatures}
					updateCreatures={this.updateMapCreatures}
					creatureCoordsUpdate={this.state.creatureCoordsUpdate}
					creatureUpdateReset={this.resetCreatureCoordsUpdate}
					currentLocation={this.state.currentLocation}
					updateLog={this.updateLog}
					unitClickHandler={this.handleUnitClick}
					weaponButtonSelected={this.state.weaponButtonSelected}
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
