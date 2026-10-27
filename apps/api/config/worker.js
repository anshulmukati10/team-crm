import cron from 'node-cron'
import { prisma } from './prismaClient.js'
import redis from './redis.js'


const QUEUE = 'crm:message:buffer'
const PROCESSING_QUEUE = 'crm:message:processing'
const BATCH_SIZE = 250
let isFlushing = false

async function flushMessages() {
    if (isFlushing) return;
    isFlushing = true;
    try {
        const pending = await redis.llen(PROCESSING_QUEUE);
        if (pending === 0) {
            for (let index = 0; index < BATCH_SIZE; index++) {
                const moved = await redis.rpoplpush(QUEUE, PROCESSING_QUEUE);
                if (!moved) break;
            }
        }

        const messages = await redis.lrange(PROCESSING_QUEUE, 0, -1);
        if (messages.length === 0) return;

        const data = messages.map((raw) => {
            const { id, roomId, text, userId, createdAt } = JSON.parse(raw);
            return {
                id,
                roomId,
                text,
                userId,
                createdAt: new Date(createdAt),
            };
        });
        await prisma.message.createMany({
            data,
            skipDuplicates: true,
        });
        await redis.del(PROCESSING_QUEUE);
        console.log(`Saved ${messages.length} messages`);

    } catch (error) {
        console.error('Message flush failed:', error);
    } finally {
        isFlushing = false;
    }
}
cron.schedule('0 */1 * * * *', flushMessages);