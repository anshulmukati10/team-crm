const readReceipts = new Map();

export function getRoomReceipts(roomId) {
  const roomReceipts = readReceipts.get(String(roomId));
  return roomReceipts ? Object.fromEntries(roomReceipts) : {};
}

export function getUserReceipt(roomId, userId) {
  return readReceipts.get(String(roomId))?.get(String(userId)) || null;
}

export function updateUserReceipt(roomId, userId, receipt) {
  const roomKey = String(roomId);
  const userKey = String(userId);
  let roomReceipts = readReceipts.get(roomKey);
  if (!roomReceipts) {
    roomReceipts = new Map();
    readReceipts.set(roomKey, roomReceipts);
  }

  const current = roomReceipts.get(userKey);
  if (current && current.rank >= receipt.rank) return null;

  roomReceipts.set(userKey, receipt);
  return receipt;
}

export function clearRoomReceipts(roomId) {
  readReceipts.delete(String(roomId));
}
