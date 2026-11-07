import type { MeetingType } from '../api/meetingTypes';
import { durationText } from '../api/meetingTypes';

// Shared rendering of meeting type items in creation order (earliest first).
export function MeetingTypeCatalog({ meetingTypes }: { meetingTypes: MeetingType[] }) {
  return (
    <ol className="catalog">
      {meetingTypes.map((meetingType) => (
        <li className="meeting-type" key={meetingType.id}>
          <h3>{meetingType.name}</h3>
          <p>{meetingType.description}</p>
          <p className="duration">{durationText(meetingType.durationMinutes)}</p>
        </li>
      ))}
    </ol>
  );
}
