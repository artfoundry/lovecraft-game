import React from 'react';
import {diceRoll} from './Utils';
import PlayerCharacterTypes from './data/playerCharacterTypes.json';
import ItemTypes from './data/itemTypes.json';
import WeaponTypes from './data/weaponTypes.json';
import './css/characterCreation.css';


export default class CharacterCreation extends React.Component {
	constructor(props) {
		super(props);

		this.showRoll = 1;
		this.baseAttr = 3;
		this.privateEyeStrBonus = PlayerCharacterTypes.privateEye.strength - this.baseAttr;
		this.privateEyeAgilBonus = PlayerCharacterTypes.privateEye.agility - this.baseAttr;
		this.privateEyeMentalBonus = PlayerCharacterTypes.privateEye.mentalAcuity - this.baseAttr;
		this.archaeologistStrBonus = PlayerCharacterTypes.archaeologist.strength - this.baseAttr;
		this.archaeologistAgilBonus = PlayerCharacterTypes.archaeologist.agility - this.baseAttr;
		this.archaeologistMentalBonus = PlayerCharacterTypes.archaeologist.mentalAcuity - this.baseAttr;
		this.chemistStrBonus = PlayerCharacterTypes.chemist.strength - this.baseAttr;
		this.chemistAgilBonus = PlayerCharacterTypes.chemist.agility - this.baseAttr;
		this.chemistMentalBonus = PlayerCharacterTypes.chemist.mentalAcuity - this.baseAttr;
		this.doctorStrBonus = PlayerCharacterTypes.doctor.strength - this.baseAttr;
		this.doctorAgilBonus = PlayerCharacterTypes.doctor.agility - this.baseAttr;
		this.doctorMentalBonus = PlayerCharacterTypes.doctor.mentalAcuity - this.baseAttr;
		this.priestStrBonus = PlayerCharacterTypes.priest.strength - this.baseAttr;
		this.priestAgilBonus = PlayerCharacterTypes.priest.agility - this.baseAttr;
		this.priestMentalBonus = PlayerCharacterTypes.priest.mentalAcuity - this.baseAttr;
		this.veteranStrBonus = PlayerCharacterTypes.veteran.strength - this.baseAttr;
		this.veteranAgilBonus = PlayerCharacterTypes.veteran.agility - this.baseAttr;
		this.veteranMentalBonus = PlayerCharacterTypes.veteran.mentalAcuity - this.baseAttr;
		this.thiefStrBonus = PlayerCharacterTypes.thief.strength - this.baseAttr;
		this.thiefAgilBonus = PlayerCharacterTypes.thief.agility - this.baseAttr;
		this.thiefMentalBonus = PlayerCharacterTypes.thief.mentalAcuity - this.baseAttr;
		this.occultResearcherStrBonus = PlayerCharacterTypes.occultResearcher.strength - this.baseAttr;
		this.occultResearcherAgilBonus = PlayerCharacterTypes.occultResearcher.agility - this.baseAttr;
		this.occultResearcherMentalBonus = PlayerCharacterTypes.occultResearcher.mentalAcuity - this.baseAttr;

		this.state = {
			name: '',
			gender: '',
			profession: null,
			statsRolled: {
				roll1: {strength: 0, agility: 0, mentalAcuity: 0},
				roll2: {strength: 0, agility: 0, mentalAcuity: 0},
				roll3: {strength: 0, agility: 0, mentalAcuity: 0}
			},
			statsSaved: {strength: 0, agility: 0, mentalAcuity: 0},
			rollCount: 1,
			rollNumSaved: 0,
			companions: []
		}
	}

	updateValue = (value) => {
		this.setState(value);
	}

	addCompanion = (id) => {
		let list = [...this.state.companions];
		if (list.includes(id)) {
			return;
		} else if (list.length === 2) {
			list.shift();
		}
		list.push(id);
		this.updateValue({companions: list});
	}


	rollStats = () => {
		setTimeout(() => {
			const roll = {strength: diceRoll(4), agility: diceRoll(4), mentalAcuity: diceRoll(4)};
			const key = 'roll' + this.state.rollCount;
			this.setState(prevState => ({
				statsRolled: {
					...prevState.statsRolled,
					[key]: roll
				}
			}), () => {
				if (this.showRoll < 10) {
					this.rollStats();
					this.showRoll++;
				} else {
					this.showRoll = 1;
					const rollCount = this.state.rollCount + 1;
					this.setState({rollCount});
				}
			});
		}, 150);
	}

	render() {
		return (
			<div id='char-creation-container'>
				<h2 className='font-fancy'>War of the Old Ones</h2>
				<p>
					Welcome friend to Miskatonic University. I was hoping you would come as soon as you had received my letter.
					We have much to discuss, and I'm sure you have many questions.
					But first, get situated and then let me introduce you to the others who have joined us.
					You'll likely want to make friends with a couple of them, as you'll no doubt need their assistance in your investigations.
					Then once you've chosen your companions, my first task for you will be to explore the crypt we recently discovered beneath the Miskatonic Museum!
				</p>
				<hr />

				<form>
					<h3><u>First, create your lead investigator</u></h3>

					<h3 className='font-fancy'>~ Name ~</h3>
					<input type='text' value={this.state.name} onChange={evt => this.updateValue({name: evt.target.value})} />

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
					<div>Roll your initial attributes: Roll three times, then choose one.</div>

					<div id='char-creation-stat-roll-container'>
						<div className={`char-creation-button roll-button ${this.state.rollCount > 3 ? 'button-disabled' : ''}`} onClick={this.rollStats}>Roll</div>
						<div>Strength:</div>
						<div className='stat-roll-box'>{this.state.statsRolled.roll1.strength}</div>
						<div className='stat-roll-box'>{this.state.statsRolled.roll2.strength}</div>
						<div className='stat-roll-box'>{this.state.statsRolled.roll3.strength}</div>
						<div>Agility:</div>
						<div className='stat-roll-box'>{this.state.statsRolled.roll1.agility}</div>
						<div className='stat-roll-box'>{this.state.statsRolled.roll2.agility}</div>
						<div className='stat-roll-box'>{this.state.statsRolled.roll3.agility}</div>
						<div>Mental Acuity:</div>
						<div className='stat-roll-box'>{this.state.statsRolled.roll1.mentalAcuity}</div>
						<div className='stat-roll-box'>{this.state.statsRolled.roll2.mentalAcuity}</div>
						<div className='stat-roll-box'>{this.state.statsRolled.roll3.mentalAcuity}</div>
						<div>Now choose:</div>
						<div className={`char-creation-button ${this.state.statsRolled.roll3.strength === 0 ? 'button-disabled' : ''} ${this.state.rollNumSaved === 1 ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({statsSaved: this.state.statsRolled.roll1, rollNumSaved: 1})}
						>1</div>
						<div className={`char-creation-button ${this.state.statsRolled.roll3.strength === 0 ? 'button-disabled' : ''} ${this.state.rollNumSaved === 2 ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({statsSaved: this.state.statsRolled.roll2, rollNumSaved: 2})}
						>2</div>
						<div className={`char-creation-button ${this.state.statsRolled.roll3.strength === 0 ? 'button-disabled' : ''} ${this.state.rollNumSaved === 3 ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({statsSaved: this.state.statsRolled.roll3, rollNumSaved: 3})}
						>3</div>
					</div>
					<div>(you can change it anytime before finishing character creation)</div>

					<h3 className='font-fancy'>~ Professions ~</h3>
					<div id='char-creation-prof-container'>
						<div className={`char-creation-prof ${this.state.profession === 'privateEye' ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({profession: 'privateEye'})}
						>
							<h4 className='font-fancy'>Private Investigator</h4>
							<p><u>Starting Attributes</u></p>
							<div>Strength: {this.state.statsSaved.strength + this.privateEyeStrBonus} ({this.privateEyeStrBonus + (this.privateEyeStrBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Agility: {this.state.statsSaved.agility + this.privateEyeAgilBonus} ({this.privateEyeAgilBonus + (this.privateEyeAgilBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Mental Acuity: {this.state.statsSaved.mentalAcuity + this.privateEyeMentalBonus} ({this.privateEyeMentalBonus + (this.privateEyeMentalBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Starting Health: {PlayerCharacterTypes.privateEye.startingHealth}</div>
							<div>Starting Sanity: {PlayerCharacterTypes.privateEye.startingSanity}</div>
							<div>Starting Spirit: {PlayerCharacterTypes.privateEye.startingSpirit}</div>
							<p><u>Starting Equipment</u></p>
							<div>Colt Revolver (6 rounds), 6 extra Handgun Ammo, Lantern</div>
							<p><u>Starting Skills</u></p>
							<div>Quick Reload: Reload your handgun without using an action (20 Spirit)</div>
						</div>
						<div className={`char-creation-prof ${this.state.profession === 'archaeologist' ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({profession: 'archaeologist'})}
						>
							<h4 className='font-fancy'>Archaeologist</h4>
							<p><u>Starting Attributes</u></p>
							<div>Strength: {this.state.statsSaved.strength + this.archaeologistStrBonus} ({this.archaeologistStrBonus + (this.archaeologistStrBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Agility: {this.state.statsSaved.agility + this.archaeologistAgilBonus} ({this.archaeologistAgilBonus + (this.archaeologistAgilBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Mental Acuity: {this.state.statsSaved.mentalAcuity + this.archaeologistMentalBonus} ({this.archaeologistMentalBonus + (this.archaeologistMentalBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Starting Health: {PlayerCharacterTypes.archaeologist.startingHealth}</div>
							<div>Starting Sanity: {PlayerCharacterTypes.archaeologist.startingSanity}</div>
							<div>Starting Spirit: {PlayerCharacterTypes.archaeologist.startingSpirit}</div>
							<p><u>Starting Equipment</u></p>
							<div>Pickaxe, Torch</div>
							<p><u>Starting Skills</u></p>
							<div>Always On The Lookout: Increased chance of finding Relics</div>
						</div>
						<div className={`char-creation-prof ${this.state.profession === 'chemist' ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({profession: 'chemist'})}
						>
							<h4 className='font-fancy'>Chemist</h4>
							<div><u>Starting Attributes</u></div>
							<div>Strength: {this.state.statsSaved.strength + this.chemistStrBonus} ({this.chemistStrBonus + (this.chemistStrBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Agility: {this.state.statsSaved.agility + this.chemistAgilBonus} ({this.chemistAgilBonus + (this.chemistAgilBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Mental Acuity: {this.state.statsSaved.mentalAcuity + this.chemistMentalBonus} ({this.chemistMentalBonus + (this.chemistMentalBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Starting Health: {PlayerCharacterTypes.chemist.startingHealth}</div>
							<div>Starting Sanity: {PlayerCharacterTypes.chemist.startingSanity}</div>
							<div>Starting Spirit: {PlayerCharacterTypes.chemist.startingSpirit}</div>
							<p><u>Starting Equipment</u></p>
							<div>2 Acid Concoctions, 1 Pharmaceutical, Lantern</div>
							<p><u>Starting Skills</u></p>
							<div>Brew Concoctions: Can create 1 Acid Concoction or 1 Pharmaceutical (20 Spirit)</div>
						</div>
						<div className={`char-creation-prof ${this.state.profession === 'doctor' ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({profession: 'doctor'})}
						>
							<h4 className='font-fancy'>Doctor</h4>
							<div><u>Starting Attributes</u></div>
							<div>Strength: {this.state.statsSaved.strength + this.doctorStrBonus} ({this.doctorStrBonus + (this.doctorStrBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Agility: {this.state.statsSaved.agility + this.doctorAgilBonus} ({this.doctorAgilBonus + (this.doctorAgilBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Mental Acuity: {this.state.statsSaved.mentalAcuity + this.doctorMentalBonus} ({this.doctorMentalBonus + (this.doctorMentalBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Starting Health: {PlayerCharacterTypes.doctor.startingHealth}</div>
							<div>Starting Sanity: {PlayerCharacterTypes.doctor.startingSanity}</div>
							<div>Starting Spirit: {PlayerCharacterTypes.doctor.startingSpirit}</div>
							<p><u>Starting Equipment</u></p>
							<div>2 First Aid Kits, 1 Pharmaceuticals, Lantern</div>
							<p><u>Starting Skills</u></p>

						</div>
						<div className={`char-creation-prof ${this.state.profession === 'priest' ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({profession: 'priest'})}
						>
							<h4 className='font-fancy'>Priest</h4>
							<div><u>Starting Attributes</u></div>
							<div>Strength: {this.state.statsSaved.strength + this.priestStrBonus} ({this.priestStrBonus + (this.priestStrBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Agility: {this.state.statsSaved.agility + this.priestAgilBonus} ({this.priestAgilBonus + (this.priestAgilBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Mental Acuity: {this.state.statsSaved.mentalAcuity + this.priestMentalBonus} ({this.priestMentalBonus + (this.priestMentalBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Starting Health: {PlayerCharacterTypes.priest.startingHealth}</div>
							<div>Starting Sanity: {PlayerCharacterTypes.priest.startingSanity}</div>
							<div>Starting Spirit: {PlayerCharacterTypes.priest.startingSpirit}</div>
							<p><u>Starting Equipment</u></p>
							<div>2 Holy Water vials, Baseball Bat, 1 First Aid Kit, Torch</div>
							<p><u>Starting Skills</u></p>

						</div>
						<div className={`char-creation-prof ${this.state.profession === 'veteran' ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({profession: 'veteran'})}
						>
							<h4 className='font-fancy'>WWI Veteran</h4>
							<div><u>Starting Attributes</u></div>
							<div>Strength: {this.state.statsSaved.strength + this.veteranStrBonus} ({this.veteranStrBonus + (this.veteranStrBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Agility: {this.state.statsSaved.agility + this.veteranAgilBonus} ({this.veteranAgilBonus + (this.veteranAgilBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Mental Acuity: {this.state.statsSaved.mentalAcuity + this.veteranMentalBonus} ({this.veteranMentalBonus + (this.veteranMentalBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Starting Health: {PlayerCharacterTypes.veteran.startingHealth}</div>
							<div>Starting Sanity: {PlayerCharacterTypes.veteran.startingSanity}</div>
							<div>Starting Spirit: {PlayerCharacterTypes.veteran.startingSpirit}</div>
							<p><u>Starting Equipment</u></p>
							<div>Remington shotgun (5 rounds), 5 extra Shotgun Ammo, Knife, Leather Jacket</div>
							<p><u>Starting Skills</u></p>

						</div>
						<div className={`char-creation-prof ${this.state.profession === 'thief' ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({profession: 'thief'})}
						>
							<h4 className='font-fancy'>Thief</h4>
							<div><u>Starting Attributes</u></div>
							<div>Strength: {this.state.statsSaved.strength + this.thiefStrBonus} ({this.thiefStrBonus + (this.thiefStrBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Agility: {this.state.statsSaved.agility + this.thiefAgilBonus} ({this.thiefAgilBonus + (this.thiefAgilBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Mental Acuity: {this.state.statsSaved.mentalAcuity + this.thiefMentalBonus} ({this.thiefMentalBonus + (this.thiefMentalBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Starting Health: {PlayerCharacterTypes.thief.startingHealth}</div>
							<div>Starting Sanity: {PlayerCharacterTypes.thief.startingSanity}</div>
							<div>Starting Spirit: {PlayerCharacterTypes.thief.startingSpirit}</div>
							<p><u>Starting Equipment</u></p>
							<div>Knife, Electric Torch</div>
							<p><u>Starting Skills</u></p>

						</div>
						<div className={`char-creation-prof ${this.state.profession === 'occultResearcher' ? 'button-selected' : ''}`}
						     onClick={() => this.updateValue({profession: 'occultResearcher'})}
						>
							<h4 className='font-fancy'>Occult Researcher</h4>
							<div><u>Starting Attributes</u></div>
							<div>Strength: {this.state.statsSaved.strength + this.occultResearcherStrBonus} ({this.occultResearcherStrBonus + (this.occultResearcherStrBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Agility: {this.state.statsSaved.agility + this.occultResearcherAgilBonus} ({this.occultResearcherAgilBonus + (this.occultResearcherAgilBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Mental Acuity: {this.state.statsSaved.mentalAcuity + this.occultResearcherMentalBonus} ({this.occultResearcherMentalBonus + (this.occultResearcherMentalBonus >= 0 ? ' bonus' : ' penalty')})</div>
							<div>Starting Health: {PlayerCharacterTypes.occultResearcher.startingHealth}</div>
							<div>Starting Sanity: {PlayerCharacterTypes.occultResearcher.startingSanity}</div>
							<div>Starting Spirit: {PlayerCharacterTypes.occultResearcher.startingSpirit}</div>
							<p><u>Starting Equipment</u></p>
							<div>Kris Knife, Lantern</div>
							<p><u>Starting Skills</u></p>

						</div>
					</div>

					<h3><u>Now choose two companions.</u></h3>
					<p>Each companion starts with average attributes and the same starting equipment.</p>

					<h3 className='font-fancy'>~ Companions ~</h3>
					<div id='char-creation-companions-container'>
						<div className={`char-creation-companion ${this.state.companions.includes('privateEye') ? 'button-selected' : ''}`}
						     onClick={() => this.addCompanion('privateEye')}
						>
							<h4 className='font-fancy'>Joseph Hide</h4>
							<div>Private Investigator</div>
						</div>
						<div className={`char-creation-companion ${this.state.companions.includes('archaeologist') ? 'button-selected' : ''}`}
						     onClick={() => this.addCompanion('archaeologist')}
						>
							<h4 className='font-fancy'>Mary Simpleton</h4>
							<div>Archaeologist</div>
						</div>
						<div className={`char-creation-companion ${this.state.companions.includes('chemist') ? 'button-selected' : ''}`}
						     onClick={() => this.addCompanion('chemist')}
						>
							<h4 className='font-fancy'>Helen Abernathy</h4>
							<div>Chemist</div>
						</div>
						<div className={`char-creation-companion ${this.state.companions.includes('doctor') ? 'button-selected' : ''}`}
						     onClick={() => this.addCompanion('doctor')}
						>
							<h4 className='font-fancy'>Thomas Wade</h4>
							<div>Doctor</div>
						</div>
						<div className={`char-creation-companion ${this.state.companions.includes('priest') ? 'button-selected' : ''}`}
						     onClick={() => this.addCompanion('priest')}
						>
							<h4 className='font-fancy'>Peter Mulcahy</h4>
							<div>Priest</div>
						</div>
						<div className={`char-creation-companion ${this.state.companions.includes('veteran') ? 'button-selected' : ''}`}
						     onClick={() => this.addCompanion('veteran')}
						>
							<h4 className='font-fancy'>Frank Wilcox</h4>
							<div>WWI Veteran</div>
						</div>
						<div className={`char-creation-companion ${this.state.companions.includes('thief') ? 'button-selected' : ''}`}
						     onClick={() => this.addCompanion('thief')}
						>
							<h4 className='font-fancy'>Elizabeth Smith</h4>
							<div>Thief</div>
						</div>
						<div className={`char-creation-companion ${this.state.companions.includes('occultResearcher') ? 'button-selected' : ''}`}
						     onClick={() => this.addCompanion('occultResearcher')}
						>
							<h4 className='font-fancy'>Philip Howard</h4>
							<div>Occult Researcher</div>
						</div>
					</div>

					<hr />
					<div id='char-creation-finish'>
						<p>Once you've created your investigator and chosen your companions, you can...</p>
						<div className={`char-creation-button ${(this.state.name.length === 0 || this.state.gender.length === 0 || this.state.rollNumSaved === 0 || this.state.companions.length < 2) ? 'button-disabled' : ''}`}
							onClick={() => {
								const pcData = {
									id: this.state.profession,
									name: this.state.name,
									gender: this.state.gender,
									strength: this.state.statsSaved.strength,
									agility: this.state.statsSaved.agility,
									mentalAcuity: this.state.statsSaved.mentalAcuity
								};
								const partyList = [pcData.id, ...this.state.companions];
								this.props.saveCreatedCharacter(pcData, partyList);
							}}
						>Venture Forth!</div>
					</div>
				</form>
			</div>
		);
	}
}