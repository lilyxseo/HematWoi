export function parseCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i]?.trim() ?? "";
    });
    return obj;
  });
  return { headers, rows };
}

export function parseOFX(text) {
  const rows = [];
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = trnRegex.exec(text))) {
    const block = match[1];
    const getTag = (tag) => {
      const m = new RegExp(`<${tag}>([^<]+)`, "i").exec(block);
      return m ? m[1].trim() : "";
    };
    let date = getTag("DTPOSTED").slice(0, 8);
    if (/^\d{8}$/.test(date)) {
      date = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    }
    const amount = parseFloat(getTag("TRNAMT") || "0");
    const note = getTag("MEMO") || getTag("NAME");
    rows.push({ date, amount, note });
  }
  return { headers: ["date", "amount", "note"], rows };
}

export function normalizeRows(rows, mapping) {
  return rows.map((r) => {
    let date = r[mapping.date] || "";
    if (/^\d{8}$/.test(date)) {
      date = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    } else {
      const d = new Date(date);
      if (!isNaN(d)) date = d.toISOString().slice(0, 10);
    }
    const amount = parseFloat(r[mapping.amount] || "0");
    const note = r[mapping.note] || "";
    return { date, amount, note };
  });
}

export function isDuplicate(row, txs) {
  const amt = Math.abs(Number(row.amount));
  const note = (row.note || "").trim().toLowerCase();
  return txs.some(
    (t) =>
      t.date === row.date &&
      Math.abs(Number(t.amount)) === amt &&
      (t.note || "").trim().toLowerCase() === note
  );
}
