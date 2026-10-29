/** Khóa phòng theo ngày (bảo trì, để dành cho gia đình…): các đêm [from, to) của một phòng không nhận đặt. Có bản sao `busy/blk_<id>` để website/bot thấy phòng bận. */
export interface RoomBlock { id: string; roomId: string; from: string; to: string; reason: string; createdBy?: string; createdByName?: string }
export const blockBusyId = (id: string) => `blk_${id}`;
export const BLOCK_PREFIX = "blk_";
