import { prisma } from "./prismaClient.js";
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { getRoomReceipts, updateUserReceipt } from './readReceipts.js'

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

    io.use((socket, next) => {
        try {
            const cookie = socket.handshake.headers.cookie || '';
            const token = cookie
                .split(';')
                .map((item) => item.trim())
                .find((item) => item.startsWith('token='))?.split('=')[1];

            if (!token) return next(new Error('Not authorized'));
            socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
            next();
        } catch {
            next(new Error('Not authorized'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User is connected to socket ${socket.id}`)
        socket.on('join_room', async (roomId) => {
            const member = await prisma.groupMember.findUnique({
                where: {
                    roomId_userId : {
                        userId: Number(socket.data.user.id),
                        roomId
                    }
                }
            });
            if (!member) return socket.emit('room_error', 'You are not a member of this room');
            socket.join(roomId)
            socket.emit('receipts_sync', {
                roomId,
                receipts: await getAuthorizedReceiptState(roomId)
            })
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
        socket.on('send_message', async (data, acknowledge) => {
            const { text, roomId, clientMessageId } = data;
            const userId = Number(socket.data.user.id);
            try {
                const member = await prisma.groupMember.findUnique({
                    where: {
                        roomId_userId: { userId, roomId }
                    }
                });
                if (!member) {
                    const message = 'You are not a member of this room';
                    socket.emit('room_error', message);
                    if (typeof acknowledge === 'function') {
                        acknowledge({ success: false, message });
                    }
                    return;
                }

                const newMessage = await prisma.message.create({
                    data: { text, userId, roomId }, include: {
                        user: {
                            select : {
                                name : true,
                                role : true 
                            }
                        }
                    }
                })

                io.to(roomId).emit('receive_message', {
                    ...newMessage,
                    clientMessageId
                });
                if (typeof acknowledge === 'function') {
                    acknowledge({ success: true });
                }

            } catch (error) {
                console.error("Unable to send chat message:", error);
                if (typeof acknowledge === 'function') {
                    acknowledge({
                        success: false,
                        message: 'Unable to send message. Please try again.'
                    });
                }
            }

        });
        socket.on('disconnect', () => {
            console.log(`User is disconnected on ${socket.id}`)
        })

    })


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