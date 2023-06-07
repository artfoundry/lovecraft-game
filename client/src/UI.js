import React from 'react';
import {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, ModeInfoPanel, DialogWindow} from './UIElements';
import './css/ui.css';

class UI extends React.Component {
	constructor(props) {
		super(props);

		this.uiPanelHeight = 90;

		this.uiRefs = {
			controlBar: React.createRef(),
			turnInfo: React.createRef(),
			log: React.createRef()
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
			lines.push(<div key={i} className="log-line">{line}</div>);
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
					characterId={id}
					characterName={playerInfo.name}
					weapons={playerInfo.weapons}
					ammo={playerInfo.ammo}
					toggleWeaponButton={this.props.toggleWeapon}
					weaponButtonSelected={this.props.weaponButtonSelected}
					isActiveCharacter={id === this.props.activeCharacter}
					movesRemaining={this.props.playerLimits.moves - this.props.actionsCompleted.moves}
					actionsRemaining={this.props.playerLimits.actions - this.props.actionsCompleted.actions}
					inTacticalMode={this.props.inTacticalMode}
				/>
			)
		}
		return controlPanels;
	}

	componentDidUpdate(prevProps, prevState, snapShot) {
		if (prevProps.logText !== this.props.logText) {
			this.setState({logText: [...this.props.logText]}, this.scrollLog);
		}
	}

	render() {
		return (
			<div className="ui-container">
				{this.props.showDialog && this.props.dialogProps && <this.showDialog />}

				<div ref={this.uiRefs.turnInfo} className="turn-info-container ui-panel">
					<div ref={this.uiRefs.log} className="log-container">
						{this.state.logText &&
							<div className="log-lines">
								<this.addLogLines />
							</div>
						}
					</div>

					<div className="mode-info-container">
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
								toggleWeaponButton={this.props.toggleWeapon}
								updateUnitSelectionStatus={this.props.updateUnitSelectionStatus}
								characterIsSelected={this.props.characterIsSelected}
								characterInfo={this.props.characterInfoText}
								creatureIsSelected={this.props.creatureIsSelected}
								creatureInfo={this.props.creatureInfoText}
							/>
						}
					</div>
					<div className="minimize-button general-button" onClick={() => {
						this.minimizePanel('turnInfo');
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
