import {randomUUID}  from 'node:crypto'

const meetings = new Map()

export function createMeeting(hostId, CompanyId) {
    const meetingId = randomUUID();

    meetings.set(meetingId, {
        id: meetingId,
        CompanyId,
        hostId,
        participants: new Map(),
        createdAt: new Date(),
    });

    return meetingId;
}

export function getMeeting(meetingId) {
    return meetings.get(meetingId);
}

export function deleteMeeting(meetingId) {
    return meetings.delete(meetingId);
}

export { meetings };