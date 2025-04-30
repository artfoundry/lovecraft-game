import React from 'react';
import {convertObjIdToClassId, diceRoll} from './Utils';
import {ObjectInfoWindow} from './UIElements';
import {SoundEffect} from './Audio';
import PlayerCharacterTypes from './data/playerCharacterTypes.json';
import ItemTypes from './data/itemTypes.json';
import WeaponTypes from './data/weaponTypes.json';
import Skills from './data/skills.json';
import './css/characterCreation.css';
import './css/playerCharacters.css';
import './css/ui.css';

export default class CharacterCreation extends React.PureComponent {
	constructor(props) {
		super(props);

		this.itemTypes = ItemTypes;
		this.weaponTypes = WeaponTypes;

		this.showRoll = 1;
		this.baseAttr = 3;
		this.bonuses = {
			privateEye: {
				strength: PlayerCharacterTypes.privateEye.strength - this.baseAttr,
				agility: PlayerCharacterTypes.privateEye.agility - this.baseAttr,
				mentalAcuity: PlayerCharacterTypes.privateEye.mentalAcuity - this.baseAttr
			},
			archaeologist: {
				strength: PlayerCharacterTypes.archaeologist.strength - this.baseAttr,
				agility: PlayerCharacterTypes.archaeologist.agility - this.baseAttr,
				mentalAcuity: PlayerCharacterTypes.archaeologist.mentalAcuity - this.baseAttr
			},
			chemist: {
				strength: PlayerCharacterTypes.chemist.strength - this.baseAttr,
				agility: PlayerCharacterTypes.chemist.agility - this.baseAttr,
				mentalAcuity: PlayerCharacterTypes.chemist.mentalAcuity - this.baseAttr
			},
			doctor: {
				strength: PlayerCharacterTypes.doctor.strength - this.baseAttr,
				agility: PlayerCharacterTypes.doctor.agility - this.baseAttr,
				mentalAcuity: PlayerCharacterTypes.doctor.mentalAcuity - this.baseAttr
			},
			priest: {
				strength: PlayerCharacterTypes.priest.strength - this.baseAttr,
				agility: PlayerCharacterTypes.priest.agility - this.baseAttr,
				mentalAcuity: PlayerCharacterTypes.priest.mentalAcuity - this.baseAttr
			},
			veteran: {
				strength: PlayerCharacterTypes.veteran.strength - this.baseAttr,
				agility: PlayerCharacterTypes.veteran.agility - this.baseAttr,
				mentalAcuity: PlayerCharacterTypes.veteran.mentalAcuity - this.baseAttr
			},
			thief: {
				strength: PlayerCharacterTypes.thief.strength - this.baseAttr,
				agility: PlayerCharacterTypes.thief.agility - this.baseAttr,
				mentalAcuity: PlayerCharacterTypes.thief.mentalAcuity - this.baseAttr
			},
			occultResearcher: {
				strength: PlayerCharacterTypes.occultResearcher.strength - this.baseAttr,
				agility: PlayerCharacterTypes.occultResearcher.agility - this.baseAttr,
				mentalAcuity: PlayerCharacterTypes.occultResearcher.mentalAcuity - this.baseAttr
			}
		};

		this.state = {
			firstName: '',
			lastName: '',
			gender: '',
			profession: null,
			statsRolled: {
				roll1: {strength: 0, agility: 0, mentalAcuity: 0},
				roll2: {strength: 0, agility: 0, mentalAcuity: 0},
				roll3: {strength: 0, agility: 0, mentalAcuity: 0}
			},
			statsSaved: {strength: 0, agility: 0, mentalAcuity: 0},
			rollStarted: false,
			rollCount: 1,
			rollNumSaved: 0,
			objectSelected: null,
			needToShowObjectPanel: false,
			skillSelected: null,
			needToShowSkillPanel: false
		}
	}

	updateValue = (value) => {
		this.setState(value);
	}

	showObjectPanel = () => {
		const top = `calc(50% - ${this.props.objectPanelHeight / 2}px)`;
		const left = this.props.screenData.isNarrow ? 0 : `calc(50% - ${this.props.objectPanelWidth / 2}px)`;
		return (
			<ObjectInfoWindow
				objectInfo={this.state.objectSelected}
				selectedObjPos={{top, left}}
				isDraggedObject={false}
				setObjectSelected={this.setObjectSelected}
				setObjectPanelDisplayOption={this.setObjectPanelDisplayOption}
				objHasBeenDropped={false}
				isPickUpAction={false}
				isMapObj={false}
			/>
		);
	}

	setObjectSelected = (objectSelected, needToShowObjectPanel) => {
		this.setState({objectSelected}, () => this.setObjectPanelDisplayOption(needToShowObjectPanel));
	}

	/**
	 * Sets whether to show object info panel
	 * @param needToShowObjectPanel: boolean (false when closing panel)
	 */
	setObjectPanelDisplayOption = (needToShowObjectPanel) => {
		this.setState({needToShowObjectPanel});
	}

	showSkillPanel = () => {
		const top = `calc(50% - ${this.props.objectPanelHeight / 2}px)`;
		const left = this.props.screenData.isNarrow ? 0 : `calc(50% - ${this.props.objectPanelWidth / 2}px)`;
		const panelPos= {top, left};
		const skillInfo = this.state.skillSelected;
		const cancelSkillPanel = () => {
			this.setSkillSelected(null, null);
			this.setSkillPanelDisplayOption(false);
		}
		return (
			<div className='skill-info-panel ui-panel' style={{top: panelPos.top, left: panelPos.left}}>
				<div className='general-button' onClick={() => cancelSkillPanel()}>X</div>
				{skillInfo &&
					<div className='skill-panel-container'>
						<div className='skill-panel-contents'>
							<div className={`char-creation-skill-icon skill-icon-${convertObjIdToClassId(skillInfo.id)}`}></div>
							<div className='skill-text-container'>
								<div className='font-fancy'>{skillInfo.name}</div>
								<div>{skillInfo.description}</div>
								{/*todo: Need to show cost/bonus?*/}
							</div>
						</div>
						<div className='skill-panel-buttons-container'>
							<span className='general-button' onClick={() => cancelSkillPanel()}>Close</span>
						</div>
					</div>
				}
			</div>
		);
	}

	setSkillSelected = (skillSelected, needToShowSkillPanel) => {
		this.setState({skillSelected}, () => this.setSkillPanelDisplayOption(needToShowSkillPanel));
	}

	/**
	 * Sets whether to show skill info panel
	 * @param needToShowSkillPanel: boolean (false when closing panel)
	 */
	setSkillPanelDisplayOption = (needToShowSkillPanel) => {
		this.setState({needToShowSkillPanel});
	}

	toggleDiceSound = () => {
		const audio = this.props.sfxSelectors.game.dice.current;
		audio.play().catch(e => console.log(e));
	}

	rollStats = () => {
		setTimeout(() => {
			const roll = {strength: diceRoll(4), agility: diceRoll(4), mentalAcuity: diceRoll(4)};
			const key = 'roll' + this.state.rollCount;
			this.setState(prevState => ({
				rollStarted: true,
				statsRolled: {
					...prevState.statsRolled,
					[key]: roll
				}
			}), () => {
				if (this.showRoll < 5) {
					this.rollStats();
					this.showRoll++;
				} else if (this.state.rollCount < 3) {
					this.showRoll = 1;
					const rollCount = this.state.rollCount + 1;
					this.setState({rollCount}, () => {
						this.toggleDiceSound();
						this.rollStats();
					});
				}
			});
		}, 200);
	}

	listSkills = (props) => {
		const id = props.id;
		const pcSkillIds = PlayerCharacterTypes[id].skills;
		let skillButtonList = [];

		pcSkillIds.forEach(skillId => {
			const skillInfo = Skills[skillId];
			if (skillInfo.description.includes(';')) {
				skillInfo.description = skillInfo.description.split('; ').map(str => {
					return <div key={str.substring(0, 5)}>{str}</div>;
				});
			}
			skillButtonList.push(
				<div key={id + '-' + skillId}
				     className={`char-creation-skill char-creation-skill-icon skill-icon-${convertObjIdToClassId(skillId)}`}
				     onClick={() => {
						this.setSkillSelected({...skillInfo, id: skillId}, true);
					 }}
				></div>
			)
		});
		return skillButtonList;
	}

	listItems = (props) => {
		const id = props.id;
		const allItems = {...PlayerCharacterTypes[id].weapons, ...PlayerCharacterTypes[id].items};
		let itemButtonList = [];

		for (const [itemId, itemInfo] of Object.entries(allItems)) {
			itemButtonList.push(
				<div key={id + '-' + itemId}
				     className={`inv-object ${convertObjIdToClassId(itemId)}-inv char-creation-item`}
				     onClick={() => {
						const object = this.itemTypes[itemInfo.name] || this.weaponTypes[itemInfo.name];
						object.id = itemId;
						object.name = itemInfo.name;
						object.isIdentified = true;
						this.setObjectSelected(object, true);
					 }}
				></div>
			)
		}
		return itemButtonList;
	}

	listProfessions = () => {
		let professionsList = [];

		for (const [id, profInfo] of Object.entries(PlayerCharacterTypes)) {
			professionsList.push(
				<div className='char-creation-prof' key={id}>
					<div className={`char-creation-prof-header ${this.state.profession === id ? 'button-selected' : ''}`}
					     onClick={() => this.updateValue({profession: id})}
					>
						<div className={`char-creation-prof-icon ${convertObjIdToClassId(id)}`}></div>
						<h4 className='font-fancy'>{profInfo.profession}</h4>
					</div>
					<p><u>Starting Attributes</u></p>
					<div>Strength: {this.state.statsSaved.strength + this.bonuses[id].strength} ({this.bonuses[id].strength + (this.bonuses[id].strength >= 0 ? ' bonus' : ' penalty')})</div>
					<div>Agility: {this.state.statsSaved.agility + this.bonuses[id].agility} ({this.bonuses[id].agility + (this.bonuses[id].agility >= 0 ? ' bonus' : ' penalty')})</div>
					<div>Mental Acuity: {this.state.statsSaved.mentalAcuity + this.bonuses[id].mentalAcuity} ({this.bonuses[id].mentalAcuity + (this.bonuses[id].mentalAcuity >= 0 ? ' bonus' : ' penalty')})</div>
					<div>Starting Health: {PlayerCharacterTypes[id].startingHealth}</div>
					<div>Starting Sanity: {PlayerCharacterTypes[id].startingSanity}</div>
					<div>Starting Spirit: {PlayerCharacterTypes[id].startingSpirit}</div>
					<p><u>Starting Equipment</u></p>
					<div className='char-creation-items-container'>
						{<this.listItems id={id} />}
					</div>
					<p><u>Skills</u></p>
					<div className='char-creation-skills-container'>
						{<this.listSkills id={id} />}
					</div>
				</div>
			)
		}
		return professionsList;
	}

	render() {
		return (
			<div id='char-creation-container'>
				<h2 className='font-fancy'>War of the Old Ones</h2>

				<form>
					<h3><u>Create your lead investigator</u></h3>

					<h3 className='font-fancy'>~ Name ~</h3>
					<div id='name-entry'>
						<div>First: <input type='text' value={this.state.firstName} maxLength='14' onChange={evt => this.updateValue({firstName: evt.target.value})} /></div>
						<div>Last (optional): <input type='text' value={this.state.lastName} maxLength={14 - this.state.firstName.length} onChange={evt => this.updateValue({lastName: evt.target.value})} /></div>
					</div>
					<div>Max 14 characters for the entire name.</div>

					<h3 className='font-fancy'>~ Gender ~</h3>
					<label>
						<input
							type="radio"
							name="char-gender"
							value="Male"
							checked={this.state.gender === "Male"}
							onChange={evt => this.updateValue({gender: evt.target.value})}
						/>
						Male
					</label>
					<label>
						<input
							type="radio"
							name="char-gender"
							value="Female"
							checked={this.state.gender === "Female"}
							onChange={evt => this.updateValue({gender: evt.target.value})}
						/>
						Female
					</label>

					<h3 className='font-fancy'>~ Attributes ~</h3>
					<div>Roll your initial attributes: Roll up to three times, then choose one.</div>

					<div id='char-creation-stat-roll-container'>
						<SoundEffect key='sfx-Dice' idProp='sfx-dice' sourceName='dice' />
						<div className={`char-creation-button roll-button${this.state.rollStarted ? ' button-disabled' : ''}`}
						     onClick={() => {
								 this.toggleDiceSound();
								 this.rollStats();
							 }}
						>Roll</div>
						<div>Strength:</div>
						<div className={`stat-roll-box dice die-${this.state.statsRolled.roll1.strength}`}></div>
						<div className={`stat-roll-box dice die-${this.state.statsRolled.roll2.strength}`}></div>
						<div className={`stat-roll-box dice die-${this.state.statsRolled.roll3.strength}`}></div>
						<div>Agility:</div>
						<div className={`stat-roll-box dice die-${this.state.statsRolled.roll1.agility}`}></div>
						<div className={`stat-roll-box dice die-${this.state.statsRolled.roll2.agility}`}></div>
						<div className={`stat-roll-box dice die-${this.state.statsRolled.roll3.agility}`}></div>
						<div>Mental Acuity:</div>
						<div className={`stat-roll-box dice die-${this.state.statsRolled.roll1.mentalAcuity}`}></div>
						<div className={`stat-roll-box dice die-${this.state.statsRolled.roll2.mentalAcuity}`}></div>
						<div className={`stat-roll-box dice die-${this.state.statsRolled.roll3.mentalAcuity}`}></div>
						<div>Now choose:</div>
						<div className={`char-creation-button ${this.state.statsRolled.roll1.strength === 0 ? 'button-disabled' : ''} ${this.state.rollNumSaved === 1 ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({statsSaved: this.state.statsRolled.roll1, rollNumSaved: 1})}
						>1</div>
						<div className={`char-creation-button ${this.state.statsRolled.roll2.strength === 0 ? 'button-disabled' : ''} ${this.state.rollNumSaved === 2 ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({statsSaved: this.state.statsRolled.roll2, rollNumSaved: 2})}
						>2</div>
						<div className={`char-creation-button ${this.state.statsRolled.roll3.strength === 0 ? 'button-disabled' : ''} ${this.state.rollNumSaved === 3 ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({statsSaved: this.state.statsRolled.roll3, rollNumSaved: 3})}
						>3</div>
					</div>
					<div>(you can change it anytime before finishing character creation)</div>

					<h3 className='font-fancy'>~ Professions ~</h3>
					<div id='char-creation-prof-container'>
						{<this.listProfessions />}
					</div>

					<hr />
					<div id='char-creation-finish'>
						<p>Once you've created your investigator, you can...</p>
						<div className={`char-creation-button ${(this.state.firstName.length === 0 || this.state.gender.length === 0 || this.state.rollNumSaved === 0 || !this.state.profession) ? 'button-disabled' : ''}`}
							onClick={() => {
								const pcData = {
									id: this.state.profession,
									name: {first: this.state.firstName, last: this.state.lastName},
									gender: this.state.gender,
									strength: this.state.statsSaved.strength + this.bonuses[this.state.profession].strength,
									agility: this.state.statsSaved.agility + this.bonuses[this.state.profession].agility,
									mentalAcuity: this.state.statsSaved.mentalAcuity + this.bonuses[this.state.profession].mentalAcuity
								};
								this.props.saveCreatedCharacter(pcData);
							}}
						>Venture Forth!</div>
					</div>
				</form>
				{this.state.needToShowObjectPanel && <this.showObjectPanel />}
				{this.state.needToShowSkillPanel && <this.showSkillPanel />}
			</div>
		);
	}
}