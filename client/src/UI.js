import React from 'react';
import {CharacterControls} from './UIElements';
import './css/ui.css';

class UI extends React.Component {
	constructor(props) {
		super(props);

		this.toggleWeaponHandler = this.props.toggleWeaponProp;

		this.state = {
			logText: this.props.logTextProp,
			characterIsSelected: this.props.characterIsSelectedProp,
			creatureIsSelected: this.props.creatureIsSelectedProp,
			characterText: this.props.characterInfoTextProp,
			controlBarContent: this.props.controlsContentProp,
			weaponButtonSelected: this.props.weaponButtonSelectedProp
		};
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
		if (prevProps.logTextProp !== this.props.logTextProp) {
			this.setState({logText: [...this.props.logTextProp]});
		}
		if (prevProps.characterIsSelectedProp !== this.props.characterIsSelectedProp) {
			this.setState(prevState => ({characterIsSelected: !prevState.characterIsSelected}));
		}
		if (prevProps.creatureIsSelectedProp !== this.props.creatureIsSelectedProp) {
			this.setState(prevState => ({creatureIsSelected: !prevState.creatureIsSelected}));
		}
	}

	render() {
		return (
			<div className="ui-container">
				<div className="log-container">{this.state.logText && <this.addLogLines />}</div>
				<div className={`character-info-container ${this.state.characterIsSelected || this.state.creatureIsSelected ? '' : 'hide'}`}>{this.state.characterText && <this.showCharacterInfo />}</div>
				<div className="control-bar-container">{this.state.controlBarContent && <this.showControlBar />}</div>
			</div>
		);
	}
}

export default UI;
