import React from 'react';
import {CharacterControls, DialogWindow} from './UIElements';
import './css/ui.css';

class UI extends React.Component {
	constructor(props) {
		super(props);

		this.toggleWeaponHandler = this.props.toggleWeapon;

		this.state = {
			logText: this.props.logText,
			characterIsSelected: this.props.characterIsSelected,
			creatureIsSelected: this.props.creatureIsSelected,
			characterText: this.props.characterInfoText,
			controlBarContent: this.props.controlsContent,
			weaponButtonSelected: this.props.weaponButtonSelected
		};
	}

	showDialog = () => {
		return (
			<DialogWindow
				classes={this.props.dialogProps.dialogClasses}
				dialogText={this.props.dialogProps.dialogText}
				closeButtonText={this.props.dialogProps.closeButtonText}
				actionButtonVisible={this.props.dialogProps.actionButtonVisible}
				actionButtonText={this.props.dialogProps.actionButtonText}
				actionButtonCallback={this.props.dialogProps.actionButtonCallback}
				closeButtonCallback={this.closeDialog} />
		)
	}

	closeDialog = () => {
		this.props.setShowDialogProps(false);
	}

	addLogLines = () => {
		let lines = [];
		let i = 0;
		this.state.logText.forEach(line => {
			lines.push(<div key={i} className="log-line">{line}</div>);
			i++;
		});

		return lines;
	}

	showCharacterInfo() {

	}

	toggleWeapon = (characterName, weapon) => {
		let buttonState = {};
		// if no weapon selected or weapon selected doesn't match new weapon selected, set weapon state to new weapon
		if (Object.keys(this.state.weaponButtonSelected).length === 0 ||
			(this.state.weaponButtonSelected.characterName !== characterName && this.state.weaponButtonSelected.weapon !== weapon))
		{
			buttonState = {characterName, weapon};
		}
		this.setState({weaponButtonSelected: buttonState});
		this.toggleWeaponHandler(characterName, weapon);
	}

	showControlBar = () => {
		let controlPanels = [];

		for (const [id, info] of Object.entries(this.state.controlBarContent)) {
			controlPanels.push(
				<CharacterControls
					key={id}
					characterNameProp={info.name}
					weaponsProp={info.weapons}
					toggleWeaponButtonProp={this.toggleWeapon}
					weaponButtonSelectedProp={this.state.weaponButtonSelected}
				/>
			)
		}
		return controlPanels;
	}

	componentDidUpdate(prevProps, prevState, snapShot) {
		if (prevProps.logText !== this.props.logText) {
			this.setState({logText: [...this.props.logText]});
		}
		if (prevProps.characterIsSelected !== this.props.characterIsSelected) {
			this.setState(prevState => ({characterIsSelected: !prevState.characterIsSelected}));
		}
		if (prevProps.creatureIsSelected !== this.props.creatureIsSelected) {
			this.setState(prevState => ({creatureIsSelected: !prevState.creatureIsSelected}));
		}
	}

	render() {
		return (
			<div className="ui-container">
				{this.props.showDialog && <this.showDialog />}
				<div className="log-container ui-panel">{this.state.logText && <this.addLogLines />}</div>
				<div className={`character-info-container ui-panel ${this.state.characterIsSelected || this.state.creatureIsSelected ? '' : 'hide'}`}>{this.state.characterText && <this.showCharacterInfo />}</div>
				<div className="control-bar-container ui-panel">{this.state.controlBarContent && <this.showControlBar />}</div>
			</div>
		);
	}
}

export default UI;
