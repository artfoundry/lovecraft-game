import React from 'react';
import {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, ModeInfoPanel, DialogWindow} from './UIElements';
import './css/ui.css';

class UI extends React.Component {
	constructor(props) {
		super(props);

		this.uiRefs = {
			controlBar: React.createRef(),
			log: React.createRef(),
			mode: React.createRef()
		};

		this.state = {
			logText: this.props.logText,
			controlBarMinimized: false,
			logMinimized: false,
			modeMinimized: false
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
			lines.unshift(<div key={i} className="log-line">{line}</div>);
			i++;
		});

		return lines;
	}

	minimizePanel = (refName) => {
		const panelStateName = refName + 'Minimized';
		if (this.state[panelStateName]) {
			this.uiRefs[refName].current.style = 'transform: translateY(0)';
		} else if (refName === 'controlBar') {
			this.uiRefs[refName].current.style = 'transform: translateY(150px)';
		} else if (refName === 'mode' || refName === 'log') {
			this.uiRefs[refName].current.style = 'transform: translateY(-150px)';
		}
		this.setState(prevState => ({[panelStateName]: !prevState[panelStateName]}));
	}

	showControlBar = () => {
		let controlPanels = [];

		for (const [id, playerInfo] of Object.entries(this.props.playerCharacters)) {
			controlPanels.push(
				<CharacterControls
					key={id}
					characterId={id}
					characterName={playerInfo.name}
					weaponsProp={playerInfo.weapons}
					toggleWeaponButton={this.props.toggleWeapon}
					weaponButtonSelected={this.props.weaponButtonSelected}
					isActiveCharacter={id === this.props.activeCharacter}
					movesRemaining={this.props.playerLimits.moves - this.props.actionsCompleted.moves}
					actionsRemaining={this.props.playerLimits.actions - this.props.actionsCompleted.actions}
					isInCombat={this.props.isInCombat}
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
				{this.props.showDialog && this.props.dialogProps && <this.showDialog />}

				<div ref={this.uiRefs.log} className="log-container ui-panel">
					{this.state.logText && <this.addLogLines />}
					<div className="minimize-button general-button" onClick={() => {
						this.minimizePanel('log');
					}}>_</div>
				</div>

				<div ref={this.uiRefs.mode} className="mode-info-container ui-panel">
					{this.props.modeInfo &&
						<ModeInfoPanel
							isInCombat={this.props.modeInfo.isInCombat}
							toggleCombat={this.props.toggleCombatState}
							threatList={this.props.threatList}
							setShowDialogProps={this.props.setShowDialogProps}
							players={this.props.playerCharacters}
							activeCharacter={this.props.activeCharacter}
							updateActiveCharacter={this.props.updateActiveCharacter}
							endTurnCallback={this.props.updateCurrentTurn}
							toggleWeaponButton={this.props.toggleWeapon}
							updateUnitSelectionStatus={this.props.updateUnitSelectionStatus}
							characterIsSelected={this.props.characterIsSelected}
							characterInfo={this.props.characterInfoText}
							creatureIsSelected={this.props.creatureIsSelected}
							creatureInfo={this.props.creatureInfoText}
						/>
					}
					<div className="minimize-button general-button" onClick={() => {
						this.minimizePanel('mode');
					}}>_</div>
				</div>

				{this.props.characterInfoText &&
					<CharacterInfoPanel
						characterIsSelected={this.props.characterIsSelected}
						updateUnitSelectionStatus={this.props.updateUnitSelectionStatus}
						characterInfo={this.props.characterInfoText}
					/>
				}

				{this.props.creatureInfoText &&
					<CreatureInfoPanel
						creatureIsSelected={this.props.creatureIsSelected}
						updateUnitSelectionStatus={this.props.updateUnitSelectionStatus}
						creatureInfo={this.props.creatureInfoText}
					/>
				}

				<div ref={this.uiRefs.controlBar} className="control-bar-container ui-panel">
					<div className="minimize-button general-button" onClick={() => {
						this.minimizePanel('controlBar');
					}}>_</div>
					{this.props.playerCharacters && <this.showControlBar />}
				</div>
			</div>
		);
	}
}

export default UI;
