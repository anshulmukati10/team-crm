import { randomUUID } from 'node:crypto';
import redis from './redis.js';
import { prisma } from './prismaClient.js';

export default (io, socket) => {
  socket.on('send_message', async (data, callback) => {
    try {
      const { roomId, text, clientMessageId } = data || {};
      const userId = Number(socket.data.user.id);

      if (typeof text !== 'string' || !text.trim()) {
        return callback?.({ success: false, message: 'Message cannot be empty' });
      }

      if (typeof roomId !== 'string' || !roomId) {
        return callback?.({ success: false, message: 'Invalid chat room' });
      }

      const member = await prisma.groupMember.findUnique({
        where: {
          roomId_userId: { roomId, userId },
        },
      });

      if (!member) {
        return callback?.({ success: false, message: 'Access denied' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, role: true },
      });

      const message = {
        id: randomUUID(),
        clientMessageId,
        roomId,
        userId,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        user,
      };

      if (!user) {
        return callback?.({ success: false, message: 'User not found' });
      }

      await redis.lpush('crm:message:buffer', JSON.stringify(message));

      io.to(roomId).emit('receive_message', message);
      callback?.({ success: true });
    } catch (error) {
      console.error('Send message failed:', error);
      callback?.({ success: false, message: 'Message could not be queued' });
    }
  });
};