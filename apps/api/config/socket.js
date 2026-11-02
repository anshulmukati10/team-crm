import { prisma } from "./prismaClient.js";
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { getRoomReceipts, updateUserReceipt } from './readReceipts.js'
import chatHandler from "./chatHandler.js";
import { createMeeting, getMeeting, deleteMeeting } from "./meetManager.js";

let io;

async function getAuthorizedReceiptState(roomId) {
    const roomMessages = await prisma.message.findMany({
        where: { roomId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true }
    })
    const ranks = new Map(roomMessages.map((message, index) => [message.id, index + 1]))
    const receipts = getRoomReceipts(roomId)
    const userIds = Object.keys(receipts).map(Number)
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true }
    })
    const names = new Map(users.map((user) => [user.id, user.name]))
    return Object.entries(receipts).map(([userId, receipt]) => ({
        userId: Number(userId),
        name: names.get(Number(userId)) || null,
        messageId: receipt.messageId,
        rank: ranks.get(receipt.messageId) || receipt.rank,
        seenAt: receipt.seenAt
    }))
}
export const socketInit = (httpServer) => {
    io = new Server(httpServer, {
        cors:
        {
            origin: process.env.FRONTEND_URL,
            methods: ['GET', 'POST'],
            credentials: true
        },
    })
    io.use(async (socket, next) => {
        try {
            const cookieHeader =
                socket.handshake.headers.cookie || "";

            const token = cookieHeader
                .split(";")
                .map((item) => item.trim())
                .find((item) => item.startsWith("token="))
                ?.slice("token=".length);

            if (!token) {
                return next(new Error("Not authorized"));
            }

            const decoded = jwt.verify(
                decodeURIComponent(token),
                process.env.JWT_SECRET
            );

            const userId = Number(decoded.id);

            if (!Number.isInteger(userId) || userId <= 0) {
                return next(new Error("Invalid user identity"));
            }

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    role: true,
                    memberOf: true,
                },
            });

            if (!user) {
                return next(new Error("User not found"));
            }

            if (!user.memberOf) {
                return next(new Error("User has no company"));
            }

            socket.data.user = user;
            socket.data.companyId = user.memberOf;

            next();
        } catch (error) {
            next(new Error("Not authorized"));
        }
    });
    io.on('connection', (socket) => {
        // console.log("Socket connected:", socket.id);
        // console.log("Authenticated user:", socket.data.user);
        // console.log("Company ID:", socket.data.companyId);
        chatHandler(io, socket);
        // console.log(`User is connected to socket ${socket.id}`)
        socket.on('join_room', async (roomId, acknowledge) => {
            try {
                if (typeof roomId !== 'string' || !roomId) {
                    return acknowledge?.({ success: false, error: 'Invalid chat room' });
                }

                const member = await prisma.groupMember.findUnique({
                    where: {
                        roomId_userId: {
                            userId: Number(socket.data.user.id),
                            roomId
                        }
                    }
                });
                if (!member) {
                    return acknowledge?.({
                        success: false,
                        error: 'You are not a member of this room'
                    });
                }

                const messages = await prisma.message.findMany({
                    where: { roomId },
                    include: {
                        user: { select: { name: true, role: true } }
                    },
                    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
                });
                socket.join(roomId);
                const receipts = await getAuthorizedReceiptState(roomId);
                socket.emit('receipts_sync', { roomId, receipts });
                acknowledge?.({ success: true, messages });
            } catch (error) {
                console.error('Unable to join chat room:', error);
                acknowledge?.({ success: false, error: 'Unable to load this group.' });
            }
        })
        socket.on('mark_message_seen', async ({ roomId, messageId }) => {
            const userId = Number(socket.data.user.id)
            if (!roomId || typeof messageId !== 'string') return

            try {
                const member = await prisma.groupMember.findUnique({
                    where: { roomId_userId: { userId, roomId } }
                })
                if (!member) return socket.emit('room_error', 'You are not a member of this room')

                const roomMessages = await prisma.message.findMany({
                    where: { roomId },
                    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                    select: { id: true }
                })
                const rank = roomMessages.findIndex((message) => message.id === messageId)
                if (rank < 0) return

                const receipt = updateUserReceipt(roomId, userId, {
                    messageId,
                    rank: rank + 1,
                    seenAt: new Date().toISOString()
                })
                if (!receipt) return

                const receipts = await getAuthorizedReceiptState(roomId)
                io.to(roomId).emit('receipts_updated', { roomId, receipts })
            } catch (error) {
                console.error('Unable to update read receipt:', error)
            }
        })
        function leaveMeeting() {
            const meetingId = socket.data.meetingId;
            const meeting = getMeeting(meetingId);

            if (!meeting) {
                socket.data.meetingId = null;
                return;
            }

            meeting.participants.delete(socket.id);
            socket.to(`meeting${meetingId}`).emit("meeting:participant-left", {
                socketId: socket.id,
            });
            socket.leave(`meeting${meetingId}`);
            socket.data.meetingId = null;

            if (meeting.participants.size === 0) {
                deleteMeeting(meetingId);
            }
        }

        socket.on('disconnect', () => {
            leaveMeeting();
            console.log(`User is disconnected on ${socket.id}`)
        })

        socket.on('meeting:create', (callback) => {
            const userId = socket.data.user?.id;
            const companyId = socket.data.companyId;

            if (!userId || !companyId) {
                callback?.({ ok: false, message: "You must belong to a company to start a meeting." });
                return;
            }

            leaveMeeting();
            const meetingId = createMeeting(userId, companyId);
            const meeting = getMeeting(meetingId);

            meeting.participants.set(socket.id, {
                socketId: socket.id,
                userId,
                name: socket.data.user.name,
            });
            socket.data.meetingId = meetingId;
            socket.join(`meeting${meetingId}`);
            callback?.({ ok: true, meetingId });
        });

        socket.on("meeting:join", (meetingId, callback) => {
            const userId = socket.data.user?.id;
            const companyId = socket.data.companyId;
            const meeting = getMeeting(meetingId);

            if (!userId || !companyId) {
                callback?.({ ok: false, message: "You must belong to a company to join a meeting." });
                return;
            }

            if (!meeting || meeting.CompanyId !== companyId) {
                callback?.({ ok: false, message: "Meeting not found." });
                return;
            }

            if (socket.data.meetingId === meetingId && meeting.participants.has(socket.id)) {
                callback?.({
                    ok: true,
                    existingParticipants: [...meeting.participants.values()].filter(
                        (participant) => participant.socketId !== socket.id,
                    ),
                });
                return;
            }

            leaveMeeting();
            const existingParticipants = [...meeting.participants.values()];
            const participant = {
                socketId: socket.id,
                userId,
                name: socket.data.user.name,
            };
            meeting.participants.set(socket.id, participant);
            socket.data.meetingId = meetingId;
            socket.join(`meeting${meetingId}`);
            socket.to(`meeting${meetingId}`).emit("meeting:participant-joined", participant);
            callback?.({ ok: true, existingParticipants });
        });

        function relaySignal(target, event, payload) {
            const meeting = getMeeting(socket.data.meetingId);
            if (!meeting || !meeting.participants.has(socket.id) || !meeting.participants.has(target)) {
                return;
            }

            io.to(target).emit(event, { sender: socket.id, ...payload });
        }

        socket.on("webrtc:offer", ({ target, offer }) => {
            relaySignal(target, "webrtc:offer", { offer });
        });

        socket.on("webrtc:answer", ({ target, answer }) => {
            relaySignal(target, "webrtc:answer", { answer });
        });

        socket.on("webrtc:ice-candidate", ({ target, candidate }) => {
            relaySignal(target, "webrtc:ice-candidate", { candidate });
        });

        socket.on("meeting:leave", leaveMeeting);
    });

    return io;
}

export const getIo = () => {
    if (!io) {
        throw new Error("Socket.io is not intialized")
    }
    return io;
}

export const emitWorkspaceUpdate = () => {
    if (io) {
        io.emit('workspace_update')
    }
}