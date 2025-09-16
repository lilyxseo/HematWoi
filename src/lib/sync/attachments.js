import { supabase } from "../supabase";
import { getCurrentUserId } from "../session";
import { oplogStore, dbCache } from "./localdb";

export async function enqueueReceiptPut(file, txId) {
  const op = {
    opId: crypto.randomUUID(),
    entity: "storage",
    type: "STORAGE_PUT",
    payload: {
      txId,
      fileName: file.name,
      contentType: file.type,
      blob: await file.arrayBuffer(),
    },
    ts: Date.now(),
  };
  await oplogStore.add(op);
}

export async function processStoragePutBatch(slice) {
  for (const o of slice) {
    const { txId, fileName, contentType, blob } = o.payload;
    const path = `receipts/${txId}/${crypto.randomUUID()}_${fileName}`;
    const { error } = await supabase.storage
      .from("receipts")
      .upload(path, new Blob([blob]), { contentType });
    if (error) throw error;
    const { data } = supabase.storage.from("receipts").getPublicUrl(path);
    const userId = await getCurrentUserId();
    const payload = {
      id: txId,
      receipt_url: data.publicUrl,
      updated_at: new Date().toISOString(),
    };
    if (userId) payload.user_id = userId;
    const { error: upsertError } = await supabase
      .from("transactions")
      .upsert(payload, { onConflict: "id" });
    if (upsertError) throw upsertError;
    const cached = await dbCache.get("transactions", txId);
    if (cached) {
      cached.receipt_url = data.publicUrl;
      await dbCache.set("transactions", cached);
    }
  }
}
