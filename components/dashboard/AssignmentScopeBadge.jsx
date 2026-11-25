import {assignmentScope} from '../../lib/research/assignment-scope';
import './assignment-scope.css';
export default function AssignmentScopeBadge({item,scope}) {
 const value=scope||item?.contentScope||assignmentScope(item);
 return <span className="assignment-scope-badge" data-scope={value.key} title={value.reason} aria-label={'Content scope: '+value.label}>{value.label}</span>;
}
