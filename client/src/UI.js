import React from 'react';
import {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, DialogWindow} from './UIElements';
import './css/ui.css';

class UI extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			logText: this.props.logText
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
			lines.unshift(<div key={i} className="log-line">{line}</div>);
			i++;
		});

		return lines;
	}

	showControlBar = () => {
		let controlPanels = [];

		for (const [id, info] of Object.entries(this.props.controlsContent)) {
			controlPanels.push(
				<CharacterControls
					key={id}
					characterId={id}
					characterName={info.name}
					weaponsProp={info.weapons}
					toggleWeaponButton={this.props.toggleWeapon}
					weaponButtonSelected={this.props.weaponButtonSelected}
				/>
			)
		}
		return controlPanels;
	}

	componentDidUpdate(prevProps, prevState, snapShot) {
		if (prevProps.logText !== this.props.logText) {
			this.setState({logText: [...this.props.logText]});
		}
	}

	render() {
		return (
			<div className="ui-container">
				{this.props.showDialog && <this.showDialog />}
				<div className="log-container ui-panel">{this.state.logText && <this.addLogLines />}</div>
				{this.props.characterInfoText &&
					<CharacterInfoPanel
						characterIsSelected={this.props.characterIsSelected}
						characterInfo={this.props.characterInfoText} />
				}
				{this.props.creatureInfoText &&
					<CreatureInfoPanel
						creatureIsSelected={this.props.creatureIsSelected}
						creatureInfo={this.props.creatureInfoText} />
				}
				<div className="control-bar-container ui-panel">{this.props.controlsContent && <this.showControlBar />}</div>
			</div>
		);
	}
}

export default UI;
