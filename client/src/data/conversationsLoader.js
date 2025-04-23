import ProfessorNymian from './conversations/professorNymian.json';
import PrivateEye from './conversations/privateEye.json';
import Archaeologist from './conversations/archaeologist.json';
import Chemist from './conversations/chemist.json';
import Doctor from './conversations/doctor.json';
import Priest from './conversations/priest.json';
import Veteran from './conversations/veteran.json';
import Thief from './conversations/thief.json';
import OccultResearcher from './conversations/occultResearcher.json';

function AllConversations() {
	return {...ProfessorNymian, ...PrivateEye, ...Archaeologist, ...Chemist, ...Doctor, ...Priest, ...Veteran, ...Thief, ...OccultResearcher};
}

export default AllConversations();
