import { prisma } from "./prismaClient.js";
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'

let io;
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
                    userId_roomId: {
                        userId: Number(socket.data.user.id),
                        roomId
                    }
                }
            });
            if (!member) return socket.emit('room_error', 'You are not a member of this room');
            socket.join(roomId)
        })
        socket.on('send_message', async (data) => {
            const { text, roomId } = data;
            const userId = Number(socket.data.user.id);
            try {
                const member = await prisma.groupMember.findUnique({
                    where: {
                        userId_roomId: { userId, roomId }
                    }
                });
                if (!member) return socket.emit('room_error', 'You are not a member of this room');

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

                io.to(roomId).emit('receive_message', newMessage)



            } catch (error) {
                console.log(" Error : " + error)
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